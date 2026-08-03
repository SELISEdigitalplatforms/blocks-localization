import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { toast, showErrorToast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import AddEditGlossary from "./add-edit-glossary";

const saveGlossaryAsync = vi.fn();

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
  showErrorToast: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveGlossary: vi.fn(),
  useGetLanguages: vi.fn(),
  useGetLanguageModules: vi.fn(),
}));

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
      target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Glossary item added" }),
    );
    expect(onClose).toHaveBeenCalled();
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
});
