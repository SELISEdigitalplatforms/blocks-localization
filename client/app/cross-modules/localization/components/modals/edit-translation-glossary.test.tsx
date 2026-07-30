import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import EditTranslation from "./edit-translation/edit-translation";
import EditKeyGlossary from "./edit-key-glossary/edit-key-glossary";

const saveKeyAsync = vi.fn();
const autoTranslateAsync = vi.fn();

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveBlocksLanguageKey: vi.fn(),
  useGetTranslationSuggestion: vi.fn(),
  useSearchGlossaries: vi.fn(),
}));

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

const languages = [
  { itemId: "en", languageName: "English", languageCode: "en-US", isDefault: true },
  { itemId: "de", languageName: "German", languageCode: "de-DE", isDefault: false },
];

const keyDetails = {
  itemId: "k1",
  keyName: "greeting",
  moduleId: "m1",
  routes: [],
  glossaryIds: [],
  resources: [
    { culture: "en-US", value: "Hello" },
    { culture: "de-DE", value: "Hallo" },
  ],
  isPartiallyTranslated: false,
  context: "",
} as never;

describe("modals/edit-translation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useSaveBlocksLanguageKey).mockReturnValue({
      isPending: false,
      mutateAsync: saveKeyAsync,
    } as never);
    vi.mocked(hooks.useGetTranslationSuggestion).mockReturnValue({
      isPending: false,
      mutateAsync: autoTranslateAsync,
    } as never);
  });

  it("should prefill the destination translation", () => {
    render(
      withDialog(
        <EditTranslation
          dialogTitle="Edit translation"
          keyDetails={keyDetails}
          destinationLanguageCode="de-DE"
          languageListData={languages}
        />,
      ),
    );
    expect(screen.getByDisplayValue("Hallo") as HTMLTextAreaElement).toBeTruthy();
  });

  it("should save an edited translation", async () => {
    saveKeyAsync.mockResolvedValue({ success: true });
    render(
      withDialog(
        <EditTranslation
          dialogTitle="Edit translation"
          keyDetails={keyDetails}
          destinationLanguageCode="de-DE"
          languageListData={languages}
        />,
      ),
    );
    fireEvent.change(screen.getByPlaceholderText("Enter translation"), {
      target: { value: "Guten Tag" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    await waitFor(() => expect(saveKeyAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Language key updated successfully" }),
    );
  });

  it("should auto-translate the destination language", async () => {
    autoTranslateAsync.mockResolvedValue({ content: "Bonjour" });
    render(
      withDialog(
        <EditTranslation
          dialogTitle="Edit translation"
          keyDetails={keyDetails}
          destinationLanguageCode="de-DE"
          languageListData={languages}
        />,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /Auto-Translate/ }));
    await waitFor(() => expect(autoTranslateAsync).toHaveBeenCalled());
    expect((screen.getByPlaceholderText("Enter translation") as HTMLTextAreaElement).value).toBe(
      "Bonjour",
    );
  });

  it("should add a translation for a language with no existing resource", async () => {
    saveKeyAsync.mockResolvedValue({ success: true });
    render(
      withDialog(
        <EditTranslation
          dialogTitle="Edit translation"
          keyDetails={{ ...keyDetails, resources: [{ culture: "en-US", value: "Hello" }] }}
          destinationLanguageCode="fr-FR"
          languageListData={[
            ...languages,
            { itemId: "fr", languageName: "French", languageCode: "fr-FR", isDefault: false },
          ]}
        />,
      ),
    );
    fireEvent.change(screen.getByPlaceholderText("Enter translation"), {
      target: { value: "Bonjour" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    await waitFor(() => expect(saveKeyAsync).toHaveBeenCalled());
  });
});

describe("modals/edit-key-glossary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useSaveBlocksLanguageKey).mockReturnValue({
      isPending: false,
      mutateAsync: saveKeyAsync,
    } as never);
    vi.mocked(hooks.useSearchGlossaries).mockReturnValue({
      data: { items: [] },
    } as never);
  });

  it("should render resolved glossaries as badges", () => {
    render(
      withDialog(
        <EditKeyGlossary
          keyDetails={{ ...keyDetails, glossaryIds: ["g1"] }}
          resolvedGlossaries={[{ itemId: "g1", name: "Widget" }] as never}
          onClose={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText("Widget")).toBeTruthy();
  });

  it("should remove a glossary badge", () => {
    render(
      withDialog(
        <EditKeyGlossary
          keyDetails={{ ...keyDetails, glossaryIds: ["g1"] }}
          resolvedGlossaries={[{ itemId: "g1", name: "Widget" }] as never}
          onClose={vi.fn()}
        />,
      ),
    );
    const removeButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-x"));
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByText("Widget")).toBeNull();
  });

  it("should add a glossary from the search popover", () => {
    vi.mocked(hooks.useSearchGlossaries).mockReturnValue({
      data: { items: [{ itemId: "g2", name: "Gadget", type: "Phrase" }] },
    } as never);
    render(
      withDialog(
        <EditKeyGlossary
          keyDetails={keyDetails}
          resolvedGlossaries={[] as never}
          onClose={vi.fn()}
        />,
      ),
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /Gadget/ }));
    expect(screen.getAllByText("Gadget").length).toBeGreaterThan(1);
  });

  it("should save the selected glossary ids", async () => {
    saveKeyAsync.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(
      withDialog(
        <EditKeyGlossary
          keyDetails={{ ...keyDetails, glossaryIds: ["g1"] }}
          resolvedGlossaries={[{ itemId: "g1", name: "Widget" }] as never}
          onClose={onClose}
        />,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveKeyAsync).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});
