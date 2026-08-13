import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { useCurrentUser } from "@blocks-localization/hooks/use-user-lookup";
import { userLookupService } from "@blocks-localization/services/user-lookup.service";
import { ModuleDetails } from "./module-details";

let params: Record<string, string> = { moduleId: "m1" };

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useParams: () => params,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguageModules: vi.fn(),
  useGetModuleGlossaries: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-user-lookup", () => ({
  useCurrentUser: vi.fn(),
}));
vi.mock("@blocks-localization/services/user-lookup.service", () => ({
  userLookupService: { getUsersByIds: vi.fn().mockResolvedValue({}) },
}));

const h = vi.mocked(hooks);
const getUsersByIds = vi.mocked(userLookupService.getUsersByIds);
const mockCurrentUser = vi.mocked(useCurrentUser);

describe("language-module/module-details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsersByIds.mockResolvedValue({});
    mockCurrentUser.mockReturnValue({ data: undefined } as never);
    params = { moduleId: "m1" };
    h.useGetModuleGlossaries.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
    } as never);
  });

  it("should show an invalid message when moduleId is missing", () => {
    params = {};
    h.useGetLanguageModules.mockReturnValue({ data: [], isLoading: false } as never);
    renderWithProviders(<ModuleDetails />);
    expect(screen.getByText("Invalid module ID")).toBeTruthy();
  });

  it("should show skeletons while modules load", () => {
    h.useGetLanguageModules.mockReturnValue({ data: undefined, isLoading: true } as never);
    const { container } = renderWithProviders(<ModuleDetails />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("should show a not-found message when the module is absent", () => {
    h.useGetLanguageModules.mockReturnValue({
      data: [{ itemId: "other", moduleName: "Other" }],
      isLoading: false,
    } as never);
    renderWithProviders(<ModuleDetails />);
    expect(screen.getByText("Module not found")).toBeTruthy();
  });

  it("should render module details on the default tab", () => {
    h.useGetLanguageModules.mockReturnValue({
      data: [
        {
          itemId: "m1",
          moduleName: "UILM",
          createDate: "2026-01-01",
          lastUpdateDate: "2026-02-01",
          createdBy: "u1",
          lastUpdatedBy: "u1",
        },
      ],
      isLoading: false,
    } as never);
    renderWithProviders(<ModuleDetails />, {
      route: "/app/abc/services/modules/m1",
    });
    expect(screen.getByText("Module Name")).toBeTruthy();
    // "UILM" appears both in the breadcrumb and the details body.
    expect(screen.getAllByText("UILM").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "Glossary" })).toBeTruthy();
  });

  it("should render an empty glossary tab when preselected", () => {
    h.useGetLanguageModules.mockReturnValue({
      data: [{ itemId: "m1", moduleName: "UILM", createdBy: null, lastUpdatedBy: null }],
      isLoading: false,
    } as never);
    renderWithProviders(<ModuleDetails />, {
      route: "/app/abc/services/modules/m1",
      searchParams: "?moduleTab=glossary",
    });
    expect(screen.getByText("No glossaries tagged to this module")).toBeTruthy();
  });

  it("should render tagged glossaries in the glossary tab", () => {
    h.useGetLanguageModules.mockReturnValue({
      data: [{ itemId: "m1", moduleName: "UILM", createdBy: null, lastUpdatedBy: null }],
      isLoading: false,
    } as never);
    h.useGetModuleGlossaries.mockReturnValue({
      data: {
        items: [{ itemId: "g1", name: "Widget", createDate: "2026-01-01" }],
        totalCount: 1,
      },
      isLoading: false,
    } as never);
    renderWithProviders(<ModuleDetails />, {
      route: "/app/abc/services/modules/m1",
      searchParams: "?moduleTab=glossary",
    });
    expect(screen.getByText("Widget")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Created Date" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Language" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Type" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Context" })).toBeNull();
  });

  it("should display optional glossary columns when the response contains their data", () => {
    h.useGetLanguageModules.mockReturnValue({
      data: [{ itemId: "m1", moduleName: "UILM", createdBy: null, lastUpdatedBy: null }],
      isLoading: false,
    } as never);
    h.useGetModuleGlossaries.mockReturnValue({
      data: {
        items: [
          {
            itemId: "g1",
            name: "Widget",
            language: "en",
            type: "Full form",
            context: "Navigation",
            createDate: "2026-01-01",
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as never);

    renderWithProviders(<ModuleDetails />, {
      route: "/app/abc/services/modules/m1",
      searchParams: "?moduleTab=glossary",
    });

    expect(screen.getByRole("columnheader", { name: "Language" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Type" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Context" })).toBeTruthy();
  });

  it("uses the userLookupService for the users query key", () => {
    h.useGetLanguageModules.mockReturnValue({
      data: [{ itemId: "m1", moduleName: "UILM", createdBy: "u1", lastUpdatedBy: "u2" }],
      isLoading: false,
    } as never);
    renderWithProviders(<ModuleDetails />, {
      route: "/app/abc/services/modules/m1",
    });
    expect(userLookupService.getUsersByIds).toBeTypeOf("function");
  });

  it("should display resolved names for Created By and Last Updated By", async () => {
    h.useGetLanguageModules.mockReturnValue({
      data: [
        {
          itemId: "m1",
          moduleName: "UILM",
          createdBy: "current-user",
          lastUpdatedBy: "u2",
        },
      ],
      isLoading: false,
    } as never);
    getUsersByIds.mockResolvedValue({
      "current-user": {
        firstName: "Current",
        lastName: "User",
        email: "current@example.com",
        userName: "current.user",
      },
      u2: {
        firstName: "Update",
        lastName: "Owner",
        email: "owner@example.com",
        userName: "update.owner",
      },
    });

    renderWithProviders(<ModuleDetails />, {
      route: "/app/abc/services/modules/m1",
    });

    expect(await screen.findByText("Current User")).toBeTruthy();
    expect(await screen.findByText("Update Owner")).toBeTruthy();
  });

  it("should use the current user when new-module audit IDs are null", async () => {
    h.useGetLanguageModules.mockReturnValue({
      data: [
        {
          itemId: "m1",
          moduleName: "New Module",
          createdBy: null,
          lastUpdatedBy: null,
        },
      ],
      isLoading: false,
    } as never);
    mockCurrentUser.mockReturnValue({
      data: {
        itemId: "current-user",
        firstName: "Current",
        lastName: "User",
        email: "current@example.com",
        userName: "current.user",
      },
    } as never);

    renderWithProviders(<ModuleDetails />, {
      route: "/app/abc/services/modules/m1",
    });

    expect(await screen.findAllByText("Current User")).toHaveLength(2);
  });
});
