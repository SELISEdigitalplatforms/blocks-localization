import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceInstances } from "@/lib/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { userLookupService } from "./user-lookup.service";

vi.mock("@/lib/http-client", () => ({
  serviceInstances: {
    iamService: {
      get: vi.fn(),
      post: vi.fn(),
    },
  },
}));

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: vi.fn(),
}));

const http = serviceInstances.iamService;

describe("localization/services/user-lookup.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeEnv).mockReturnValue("https://iam.example.com");
  });

  describe("getMe", () => {
    it("should GET the /me endpoint with absoluteUrl", () => {
      vi.mocked(http.get).mockResolvedValue({ data: {}, errors: null });
      userLookupService.getMe();
      expect(http.get).toHaveBeenCalledWith("https://iam.example.com/api/iam/me", undefined, {
        absoluteUrl: true,
      });
    });

    it("should fall back to the default IAM base url when env is empty", () => {
      vi.mocked(getRuntimeEnv).mockReturnValue("");
      vi.mocked(http.get).mockResolvedValue({ data: {}, errors: null });
      userLookupService.getMe();
      expect(http.get).toHaveBeenCalledWith(
        "https://dev-iam.blocksdevelopers.com/api/iam/me",
        undefined,
        { absoluteUrl: true },
      );
    });
  });

  describe("getUsers", () => {
    it("should POST with default empty filters", () => {
      vi.mocked(http.post).mockResolvedValue({
        totalCount: 0,
        data: [],
        errors: null,
      });
      userLookupService.getUsers({ page: 1, pageSize: 50 });
      const [url, body] = vi.mocked(http.post).mock.calls[0];
      expect(url).toBe("https://iam.example.com/api/iam/users");
      expect(body).toMatchObject({
        page: 1,
        pageSize: 50,
        sort: { property: "FirstName", isDescending: false },
        filter: { email: "", name: "" },
      });
    });

    it("should forward provided email/name filters", () => {
      vi.mocked(http.post).mockResolvedValue({
        totalCount: 0,
        data: [],
        errors: null,
      });
      userLookupService.getUsers({
        page: 0,
        pageSize: 10,
        email: "a@b.com",
        name: "Alice",
      });
      const [, body] = vi.mocked(http.post).mock.calls[0];
      expect((body as unknown as Record<string, unknown>).filter).toEqual({ email: "a@b.com", name: "Alice" });
    });
  });

  describe("getUsersByIds", () => {
    it("should return an empty map when no ids are given", async () => {
      const result = await userLookupService.getUsersByIds([]);
      expect(result).toEqual({});
      expect(http.post).not.toHaveBeenCalled();
    });

    it("should ignore falsy ids and short-circuit", async () => {
      const result = await userLookupService.getUsersByIds(["", ""]);
      expect(result).toEqual({});
      expect(http.post).not.toHaveBeenCalled();
    });

    it("should resolve matching users from a single page", async () => {
      vi.mocked(http.post).mockResolvedValue({
        totalCount: 2,
        data: [
          {
            itemId: "u1",
            firstName: "A",
            lastName: "One",
            email: "a@x.com",
            userName: "a",
          },
          {
            itemId: "u2",
            firstName: "B",
            lastName: "Two",
            email: "b@x.com",
            userName: "b",
          },
        ],
        errors: null,
      });

      const result = await userLookupService.getUsersByIds(["u1"]);
      expect(result).toEqual({
        u1: { firstName: "A", lastName: "One", email: "a@x.com", userName: "a" },
      });
      // Stops once all target ids are found.
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it("should page through until all targets are found", async () => {
      // totalCount exceeds one page (pageSize is 100) so a second page is fetched.
      vi.mocked(http.post)
        .mockResolvedValueOnce({
          totalCount: 150,
          data: [
            {
              itemId: "x",
              firstName: "X",
              lastName: "",
              email: "",
              userName: "",
            },
          ],
          errors: null,
        })
        .mockResolvedValueOnce({
          totalCount: 150,
          data: [
            {
              itemId: "u2",
              firstName: "B",
              lastName: "",
              email: "",
              userName: "",
            },
          ],
          errors: null,
        });

      const result = await userLookupService.getUsersByIds(["u2"]);
      expect(result).toHaveProperty("u2");
      expect(http.post).toHaveBeenCalledTimes(2);
    });

    it("should stop when totalCount is exhausted even if targets are missing", async () => {
      vi.mocked(http.post).mockResolvedValue({
        totalCount: 1,
        data: [
          {
            itemId: "other",
            firstName: "O",
            lastName: "",
            email: "",
            userName: "",
          },
        ],
        errors: null,
      });

      const result = await userLookupService.getUsersByIds(["never"]);
      expect(result).toEqual({});
      // page 0 fetched, then 1*100 < 1 is false → loop ends.
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it("should treat a missing totalCount/data as zero/empty", async () => {
      vi.mocked(http.post).mockResolvedValue({ errors: null });
      const result = await userLookupService.getUsersByIds(["u1"]);
      expect(result).toEqual({});
    });
  });
});
