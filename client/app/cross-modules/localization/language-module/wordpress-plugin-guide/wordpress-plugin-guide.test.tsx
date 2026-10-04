import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WordPressPluginGuide } from "./wordpress-plugin-guide";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn().mockResolvedValue("https://os.example.test/secret-management/integration") }));
const { projectStore } = vi.hoisted(() => ({ projectStore: { selectedProject: { itemId: "project id" } } }));
vi.mock("@blocks-localization/services/wordpress-plugin.service", () => ({ fetchBlocksOsRedirectUrl: redirect }));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: vi.fn() }));
vi.mock("@seliseblocks/genesis-os", () => ({ useProjectStore: () => projectStore }));

it("opens Integrations in Blocks OS", async () => {
  render(<WordPressPluginGuide />);
  fireEvent.click(screen.getByRole("button", { name: "Open Integrations in Blocks OS" }));
  await vi.waitFor(() => expect(redirect).toHaveBeenCalledWith("/app/project%20id/secret-management/integration"));
});

it("is disabled when no project is selected", () => {
  projectStore.selectedProject = undefined as never;
  render(<WordPressPluginGuide />);
  expect(screen.getByRole("button", { name: "Open Integrations in Blocks OS" }).hasAttribute("disabled")).toBe(true);
  projectStore.selectedProject = { itemId: "project id" };
});
