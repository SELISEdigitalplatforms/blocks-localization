import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { KeyDetails } from "./key-details";

let params: Record<string, string> = { keyId: "k1" };

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useParams: () => params,
}));
vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@blocks-localization/components/view-details/view-details", () => ({
  default: () => <div>ViewDetailsStub</div>,
}));
vi.mock("../timeline/timeline", () => ({ default: () => <div>TimelineStub</div> }));
vi.mock(
  "@blocks-localization/components/modals/delete-language-key/delete-language-key",
  () => ({ default: () => null }),
);
vi.mock("@blocks-localization/components/modals/gpt-prompt/gpt-prompt", () => ({
  default: () => null,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetBlocksLanguageKeyById: vi.fn(),
  useGetLanguageKeysTimeline: vi.fn(),
  useTranslateKey: vi.fn(),
}));

const h = vi.mocked(hooks);

describe("language-module/key-details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = { keyId: "k1" };
    h.useGetLanguageKeysTimeline.mockReturnValue({
      data: { totalCount: 0, timelines: [] },
      isLoading: false,
    } as never);
    h.useTranslateKey.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);
  });

  it("should render a skeleton while the key loads", () => {
    h.useGetBlocksLanguageKeyById.mockReturnValue({ data: undefined } as never);
    const { container } = renderWithProviders(<KeyDetails />, {
      route: "/app/abc/services/language/translations/k1",
    });
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("should render the key name and tabs once loaded", () => {
    h.useGetBlocksLanguageKeyById.mockReturnValue({
      data: {
        itemId: "k1",
        keyName: "greeting",
        moduleId: "m1",
        resources: [],
        routes: [],
        glossaryIds: [],
      },
    } as never);
    renderWithProviders(<KeyDetails />, {
      route: "/app/abc/services/language/translations/k1",
    });
    expect(screen.getByRole("heading", { name: "greeting" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Details" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "History" })).toBeTruthy();
    // Details tab shows the ViewDetails child.
    expect(screen.getByText("ViewDetailsStub")).toBeTruthy();
  });

  it("should render the history tab timeline when preselected", async () => {
    h.useGetBlocksLanguageKeyById.mockReturnValue({
      data: {
        itemId: "k1",
        keyName: "greeting",
        moduleId: "m1",
        resources: [],
        routes: [],
        glossaryIds: [],
      },
    } as never);
    h.useGetLanguageKeysTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 1,
        timelines: [
          {
            itemId: "t1",
            logFrom: "KeyController.Create",
            userName: "Alice",
            userId: "u1",
            createDate: "2026-01-01T10:00:00Z",
          },
        ],
      },
    } as never);
    renderWithProviders(<KeyDetails />, {
      route: "/app/abc/services/language/translations/k1",
      searchParams: "?translationActivity=history",
    });
    // Timeline is stubbed; it renders once mapped events populate.
    expect(await screen.findByText("TimelineStub")).toBeTruthy();
  });
});
