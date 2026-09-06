import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WordPressPluginGuide } from "./wordpress-plugin-guide";

const { projectStoreMock } = vi.hoisted(() => ({
  projectStoreMock: {
    selectedProject: { tenantId: "project-x-dev", itemId: "project-x-dev-id" } as {
      tenantId: string;
      itemId: string;
    } | null,
  },
}));

const { getRuntimeEnvMock } = vi.hoisted(() => ({
  getRuntimeEnvMock: vi.fn(),
}));

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => projectStoreMock,
}));

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: getRuntimeEnvMock,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

describe("WordPressPluginGuide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStoreMock.selectedProject = {
      tenantId: "project-x-dev",
      itemId: "project-x-dev-id",
    };
    getRuntimeEnvMock.mockReturnValue("root-blocks-key");
  });

  it("displays the header and description", () => {
    useQueryMock.mockReturnValue({
      data: [],
      isError: false,
    });

    render(<WordPressPluginGuide />);

    expect(screen.getByText("WordPress Plugin Guide")).toBeTruthy();
    expect(screen.getByText("Connect your WordPress site to Blocks Localization.")).toBeTruthy();
  });

  it("scopes the client credential query to the selected environment", () => {
    useQueryMock.mockReturnValue({
      data: [],
      isError: false,
      isLoading: false,
    });

    const { unmount } = render(<WordPressPluginGuide />);

    expect(useQueryMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: ["wordpress-plugin-client-credentials", "project-x-dev"],
        enabled: true,
      }),
    );

    unmount();
    projectStoreMock.selectedProject = {
      tenantId: "project-x-staging",
      itemId: "project-x-staging-id",
    };
    render(<WordPressPluginGuide />);

    expect(useQueryMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: ["wordpress-plugin-client-credentials", "project-x-staging"],
        enabled: true,
      }),
    );
  });

  it("shows configured status when credentials are set up", () => {
    useQueryMock.mockReturnValue({
      data: [
        {
          name: "wordpress-localization",
          clientSecret: "wordpress-secret-123",
          accessTokenValidForNumberMinutes: 5,
          roles: ["wp_user"],
          permissions: [],
          isActive: true,
          itemId: "wordpress-client-id-123",
          createdDate: "2026-07-31T06:56:14.17Z",
          lastUpdatedDate: "2026-07-31T06:56:14.17Z",
        },
      ],
      isError: false,
    });

    render(<WordPressPluginGuide />);

    expect(screen.getAllByText("X-Blocks-Key").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Client ID").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Client Secret").length).toBeGreaterThan(0);
    expect(screen.getByText("Token lifetime")).toBeTruthy();
    expect(screen.getByText("5 min")).toBeTruthy();
    expect(screen.getByText("Role(s)")).toBeTruthy();
    expect(screen.getByText("Permission(s)")).toBeTruthy();
    expect(screen.getByText("Created on")).toBeTruthy();
    expect(screen.getByText("Updated on")).toBeTruthy();
    expect(screen.queryByText("wordpress-client-id-123")).toBeNull();
    expect(screen.queryByText("wordpress-secret-123")).toBeNull();
    expect(screen.getByText("wordpress-localization")).toBeTruthy();
    expect(screen.getByText("wp_user")).toBeTruthy();
    expect(screen.getByText(window.location.origin)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy Origin" })).toBeTruthy();
  });

  it("shows not configured when credentials are missing", () => {
    getRuntimeEnvMock.mockReturnValue("");

    useQueryMock.mockReturnValue({
      data: [],
      isError: false,
    });

    render(<WordPressPluginGuide />);

    expect(screen.getByText("Not configured")).toBeTruthy();
    expect(screen.getByText("No WordPress client credentials found")).toBeTruthy();
  });

  it("shows the Blocks OS redirect in the client credentials section", () => {
    useQueryMock.mockReturnValue({
      data: [],
      isError: false,
    });

    render(<WordPressPluginGuide />);

    expect(screen.getByRole("button", { name: /Manage in Blocks OS/ })).toBeTruthy();
    expect(screen.queryByText("Action Required")).toBeNull();
  });

  it("displays the relevant setup steps", () => {
    useQueryMock.mockReturnValue({
      data: [],
      isError: false,
    });

    render(<WordPressPluginGuide />);

    expect(screen.queryByText("Create an account and log in")).toBeNull();
    expect(screen.queryByText("Create a project and environment")).toBeNull();
    expect(screen.getByText("Create wp-user role with permissions")).toBeTruthy();
    expect(screen.getByText("Create client credentials")).toBeTruthy();
    expect(screen.getByText("Collect required credentials")).toBeTruthy();

    fireEvent.click(screen.getByText("Create wp-user role with permissions"));
    fireEvent.click(screen.getByText("Create client credentials"));

    expect(screen.getByRole("button", { name: /Go to Roles management/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Go to Create Credentials/ })).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("shows copyable configuration values in setup status", () => {
    useQueryMock.mockReturnValue({
      data: [
        {
          name: "wordpress-localization",
          clientSecret: "wordpress-secret-123",
          roles: ["wp_user"],
          isActive: true,
          itemId: "wordpress-client-id-123",
        },
      ],
      isError: false,
    });

    render(<WordPressPluginGuide />);

    const setupStatus = screen.getByText("Setup Status").closest("div");

    expect(setupStatus?.querySelector('[aria-label="Copy X-Blocks-Key"]')).toBeTruthy();
    expect(setupStatus?.querySelector('[aria-label="Copy Origin"]')).toBeTruthy();
    expect(setupStatus?.querySelector('[aria-label="Copy Client ID"]')).toBeTruthy();
    expect(setupStatus?.querySelector('[aria-label="Copy Client Secret"]')).toBeTruthy();
    expect(screen.queryByText("Copy Configuration Values")).toBeNull();
  });

  it("renders every WordPress client credential separately", () => {
    useQueryMock.mockReturnValue({
      data: [
        {
          name: "wordpress-production",
          clientSecret: "production-secret",
          roles: ["wp_user"],
          isActive: true,
          itemId: "production-client-id",
        },
        {
          name: "wordpress-staging",
          clientSecret: "staging-secret",
          roles: ["wp_user"],
          isActive: false,
          itemId: "staging-client-id",
        },
        {
          name: "mobile-app",
          clientSecret: "mobile-secret",
          roles: ["mobile_user"],
          isActive: true,
          itemId: "mobile-client-id",
        },
      ],
      isError: false,
      isLoading: false,
    });

    render(<WordPressPluginGuide />);

    expect(screen.getByText("2 credentials")).toBeTruthy();
    expect(screen.getAllByText("wordpress-production").length).toBeGreaterThan(0);
    expect(screen.getAllByText("wordpress-staging").length).toBeGreaterThan(0);
    expect(screen.queryByText("mobile-app")).toBeNull();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();

    const productionTrigger = screen.getByRole("button", { name: /wordpress-production/ });
    const stagingTrigger = screen.getByRole("button", { name: /wordpress-staging/ });

    expect(productionTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(stagingTrigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(stagingTrigger);
    expect(stagingTrigger.getAttribute("aria-expanded")).toBe("true");
  });
});
