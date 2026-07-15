import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { toast, showErrorToast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import DeleteGlossary from "./glossary/delete-glossary";
import NewModule from "./new-module/new-module";
import EditModule from "./edit-module/edit-module";
import GptPrompt from "./gpt-prompt/gpt-prompt";

const deleteGlossaryAsync = vi.fn();
const saveModuleAsync = vi.fn();
const saveKeyAsync = vi.fn();

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
  showErrorToast: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useDeleteGlossary: vi.fn(),
  useSaveLanguageModule: vi.fn(),
  useSaveBlocksLanguageKey: vi.fn(),
}));

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

describe("modals/delete-glossary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useDeleteGlossary).mockReturnValue({
      isPending: false,
      mutateAsync: deleteGlossaryAsync,
    } as never);
  });

  it("should delete and close on success", async () => {
    deleteGlossaryAsync.mockResolvedValue({ isSuccess: true });
    const onClose = vi.fn();
    render(withDialog(<DeleteGlossary itemId="g1" glossaryName="Widget" onClose={onClose} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(deleteGlossaryAsync).toHaveBeenCalledWith({ itemId: "g1" });
  });

  it("should toast when deletion fails", async () => {
    deleteGlossaryAsync.mockResolvedValue({ isSuccess: false, errors: {} });
    render(withDialog(<DeleteGlossary itemId="g1" glossaryName="Widget" onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });

  it("should handle a thrown error", async () => {
    deleteGlossaryAsync.mockRejectedValue(new Error("x"));
    render(withDialog(<DeleteGlossary itemId="g1" glossaryName="Widget" onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to delete glossary item" }),
      ),
    );
  });
});

describe("modals/new-module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useSaveLanguageModule).mockReturnValue({
      isPending: false,
      mutateAsync: saveModuleAsync,
    } as never);
  });

  it("should create a module on valid submit", async () => {
    saveModuleAsync.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(withDialog(<NewModule onClose={onClose} />));
    fireEvent.change(screen.getByPlaceholderText("Enter Module name"), {
      target: { value: "Payments" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(saveModuleAsync).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("should surface validation errors on failure", async () => {
    saveModuleAsync.mockResolvedValue({
      success: false,
      validationErrors: [{ errorMessage: "duplicate" }],
    });
    render(withDialog(<NewModule onClose={vi.fn()} />));
    fireEvent.change(screen.getByPlaceholderText("Enter Module name"), {
      target: { value: "Payments" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "duplicate" }),
    );
  });
});

describe("modals/edit-module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useSaveLanguageModule).mockReturnValue({
      isPending: false,
      mutateAsync: saveModuleAsync,
    } as never);
  });

  it("should prefill and update the module name", async () => {
    saveModuleAsync.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(
      withDialog(
        <EditModule module={{ itemId: "m1", moduleName: "UILM" } as never} onClose={onClose} />,
      ),
    );
    const input = screen.getByPlaceholderText("Enter module name") as HTMLInputElement;
    expect(input.value).toBe("UILM");
    fireEvent.change(input, { target: { value: "Renamed" } });
    // The Save button stays disabled until RHF flags the form valid, so submit
    // the form directly to exercise the handler.
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(saveModuleAsync).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("should cancel", () => {
    const onClose = vi.fn();
    render(
      withDialog(
        <EditModule module={{ itemId: "m1", moduleName: "UILM" } as never} onClose={onClose} />,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledWith(false);
  });
});

describe("modals/gpt-prompt", () => {
  const keyDetails = {
    itemId: "k1",
    keyName: "greeting",
    moduleId: "m1",
    resources: [],
    routes: [],
    glossaryIds: [],
    isPartiallyTranslated: false,
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useSaveBlocksLanguageKey).mockReturnValue({
      isPending: false,
      mutateAsync: saveKeyAsync,
    } as never);
  });

  it("should render the default prompt and support restore/clear", () => {
    render(withDialog(<GptPrompt keyDetails={keyDetails} />));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain("translate");
    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /Restore default/ }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain(
      "translate",
    );
  });

  it("should save the prompt as key context", async () => {
    saveKeyAsync.mockResolvedValue({ success: true });
    render(withDialog(<GptPrompt keyDetails={keyDetails} defaultValue="Custom" />));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveKeyAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("should toast an error when saving fails", async () => {
    saveKeyAsync.mockResolvedValue({ success: false, errorMessage: "no" });
    render(withDialog(<GptPrompt keyDetails={keyDetails} />));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });
});
