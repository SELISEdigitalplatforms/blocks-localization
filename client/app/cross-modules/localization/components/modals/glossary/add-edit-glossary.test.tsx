import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { toast, showErrorToast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import AddEditGlossary from "./add-edit-glossary";

const saveGlossaryAsync = vi.fn();
const navigate = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
  showErrorToast: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveGlossary: vi.fn(),
  useGetLanguages: vi.fn(),
  useGetLanguageModules: vi.fn(),
  useSearchGlossaries: vi.fn(),
}));

const existingGlossaries = [
  { itemId: "g1", name: "Workspace", createDate: "", lastUpdateDate: "" },
  { itemId: "g2", name: "Workspace2", createDate: "", lastUpdateDate: "" },
];

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

describe("modals/glossary/add-edit-glossary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useSaveGlossary).mockReturnValue({
      isPending: false,
      mutateAsync: saveGlossaryAsync,
    } as never);
    vi.mocked(hooks.useGetLanguages).mockReturnValue({
      data: [{ languageCode: "en-US", languageName: "English" }],
    } as never);
    vi.mocked(hooks.useGetLanguageModules).mockReturnValue({
      data: [{ itemId: "m1", moduleName: "UILM" }],
    } as never);
    vi.mocked(hooks.useSearchGlossaries).mockReturnValue({
      data: { items: existingGlossaries, totalCount: 2 },
      isError: false,
    } as never);
  });

  it("should render in add mode", () => {
    render(withDialog(<AddEditGlossary onClose={vi.fn()} isOpen />));
    expect(screen.getByText("Add Glossary")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });

  it("should render in edit mode prefilled", () => {
    render(
      withDialog(
        <AddEditGlossary
          onClose={vi.fn()}
          glossary={{ itemId: "g1", name: "Widget", createDate: "", lastUpdateDate: "" } as never}
        />,
      ),
    );
    expect(screen.getByText("Edit Glossary")).toBeTruthy();
    expect(screen.getByDisplayValue("Widget") as HTMLInputElement).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update" })).toBeTruthy();
  });

  it("should submit a new glossary", async () => {
    saveGlossaryAsync.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(withDialog(<AddEditGlossary onClose={onClose} isOpen />));
    fireEvent.change(screen.getByPlaceholderText("Enter glossary name"), {
      target: { value: "  Acme  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(saveGlossaryAsync).toHaveBeenCalledWith(expect.objectContaining({ name: "Acme" })),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Glossary item added successfully." }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("should show an inline error and prevent submission for a whitespace-only name", async () => {
    render(withDialog(<AddEditGlossary onClose={vi.fn()} isOpen />));
    fireEvent.change(screen.getByPlaceholderText("Enter glossary name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Name is required")).toBeTruthy();
    expect(saveGlossaryAsync).not.toHaveBeenCalled();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("should surface validation errors on failure", async () => {
    saveGlossaryAsync.mockResolvedValue({
      success: false,
      validationErrors: [{ errorMessage: "duplicate name" }],
    });
    render(withDialog(<AddEditGlossary onClose={vi.fn()} isOpen />));
    fireEvent.change(screen.getByPlaceholderText("Enter glossary name"), {
      target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith({ errors: "duplicate name" }));
  });

  it("should cancel", () => {
    const onClose = vi.fn();
    render(withDialog(<AddEditGlossary onClose={onClose} isOpen />));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  describe("duplicate name warning", () => {
    const typeName = (value: string) =>
      fireEvent.change(screen.getByPlaceholderText("Enter glossary name"), {
        target: { value },
      });

    const waitForDebounce = () =>
      act(async () => {
        vi.advanceTimersByTime(300);
      });

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should warn about a case-insensitive match only after 300 ms of no typing", async () => {
      render(withDialog(<AddEditGlossary onClose={vi.fn()} isOpen />));
      typeName("workspace ");
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(screen.queryByText(/already exists/)).toBeNull();
      expect(hooks.useSearchGlossaries).not.toHaveBeenCalledWith("workspace", true);

      await waitForDebounce();
      expect(hooks.useSearchGlossaries).toHaveBeenLastCalledWith("workspace", true);
      expect(screen.getByText(/'Workspace' already exists/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Open it" })).toBeTruthy();
    });

    it("should not warn for a partial match", async () => {
      render(withDialog(<AddEditGlossary onClose={vi.fn()} isOpen />));
      typeName("Works");
      await waitForDebounce();
      expect(screen.queryByText(/already exists/)).toBeNull();
    });

    it("should not query while the name is superseded by further typing", async () => {
      render(withDialog(<AddEditGlossary onClose={vi.fn()} isOpen />));
      typeName("Workspace");
      await waitForDebounce();
      typeName("Workspace2x");
      expect(screen.queryByText(/already exists/)).toBeNull();
      expect(hooks.useSearchGlossaries).toHaveBeenLastCalledWith("Workspace", false);
    });

    it("should navigate to the existing glossary from 'Open it'", async () => {
      const onClose = vi.fn();
      render(withDialog(<AddEditGlossary onClose={onClose} isOpen />));
      typeName("WORKSPACE2");
      await waitForDebounce();
      fireEvent.click(screen.getByRole("button", { name: "Open it" }));
      expect(onClose).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith("/scoped/services/glossary/g2");
    });

    it("should not warn when the match is the glossary being edited", async () => {
      render(
        withDialog(<AddEditGlossary onClose={vi.fn()} glossary={existingGlossaries[0] as never} />),
      );
      await waitForDebounce();
      expect(screen.queryByText(/already exists/)).toBeNull();
    });

    it("should show nothing and still submit when the check fails", async () => {
      vi.mocked(hooks.useSearchGlossaries).mockReturnValue({
        data: undefined,
        isError: true,
      } as never);
      saveGlossaryAsync.mockResolvedValue({ success: true });
      render(withDialog(<AddEditGlossary onClose={vi.fn()} isOpen />));
      typeName("Workspace");
      await waitForDebounce();
      expect(screen.queryByText(/already exists/)).toBeNull();
      vi.useRealTimers();
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    });

    it("should not block submit when a duplicate is shown", async () => {
      saveGlossaryAsync.mockResolvedValue({ success: true });
      render(withDialog(<AddEditGlossary onClose={vi.fn()} isOpen />));
      typeName("workspace");
      await waitForDebounce();
      expect(screen.getByText(/already exists/)).toBeTruthy();
      vi.useRealTimers();
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() =>
        expect(saveGlossaryAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: "workspace" }),
        ),
      );
    });
  });
});
