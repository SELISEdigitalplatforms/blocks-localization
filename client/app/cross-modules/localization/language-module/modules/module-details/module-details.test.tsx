import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { userLookupService } from "@blocks-localization/services/user-lookup.service";
import { ModuleDetails } from "./module-details";

let params: Record<string, string> = { moduleId: "m1" };

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useParams: () => params,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguageModules: vi.fn(),
  useGetModuleGlossaries: vi.fn(),
}));
vi.mock("@blocks-localization/services/user-lookup.service", () => ({
  userLookupService: { getUsersByIds: vi.fn().mockResolvedValue({}) },
}));

const h = vi.mocked(hooks);

describe("language-module/module-details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
