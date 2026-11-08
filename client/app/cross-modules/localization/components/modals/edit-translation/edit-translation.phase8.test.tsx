import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import {
  useGetTranslationSuggestion,
  useSaveBlocksLanguageKey,
} from "@blocks-localization/hooks/use-language-manager";
import {
  IBlocksLanguageKey,
  IGlossary,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { matchResponse } from "@blocks-localization/test-utils/helpers/glossary-matches";
import EditTranslation from "./edit-translation";

const autoTranslateAsync = vi.fn();

vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveBlocksLanguageKey: vi.fn(),
  useGetTranslationSuggestion: vi.fn(),
}));
vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: { matchGlossary: vi.fn() },
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
  useScopedPath: () => (sub: string) => `/app/p1/${sub}`,
}));
vi.mock("@blocks-localization/components/modals/glossary/glossary-editor-sheet", () => ({
  default: ({ open, initialName }: { open: boolean; initialName?: string }) =>
    open ? <div>sheet-{initialName}</div> : null,
}));

const terms: IGlossary[] = [
  {
    itemId: "g1",
    name: "Workspace",
    isGlobal: true,
    createDate: "",
    lastUpdateDate: "",
    rule: "translate",
    translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: [] }],
  },
  {
    itemId: "g2",
    name: "SELISE",
    isGlobal: true,
    createDate: "",
    lastUpdateDate: "",
    rule: "keep",
  },
  {
    itemId: "g3",
    name: "Portal",
    isGlobal: true,
    createDate: "",
    lastUpdateDate: "",
    rule: "forbidden",
  },
];

const keyDetails: IBlocksLanguageKey = {
  itemId: "key-1",
  keyName: "ws",
  moduleId: "M",
  routes: [],
  glossaryIds: [],
  resources: [
    { culture: "en-US", value: "Open your Workspace in the SELISE Portal" },
    { culture: "de-DE", value: "Öffne " },
  ],
  isPartiallyTranslated: false,
  lastUpdateDate: "",
  createDate: "",
  context: "",
};

const languages: ILanguageConfig[] = [
  { itemId: "l1", languageName: "English", languageCode: "en-US", isDefault: true },
  { itemId: "l2", languageName: "German", languageCode: "de-DE" },
];

const renderModal = (key: IBlocksLanguageKey = keyDetails, destinationLanguageCode = "de-DE") =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Dialog open>
        <EditTranslation
          dialogTitle="Edit translation"
          keyDetails={key}
          destinationLanguageCode={destinationLanguageCode}
          languageListData={languages}
          onClose={vi.fn()}
        />
      </Dialog>
    </QueryClientProvider>,
  );

const field = () => screen.getByPlaceholderText("Enter translation") as HTMLTextAreaElement;

const selectSourceText = (text: string) => {
  const source = screen.getByText((_, element) =>
    element?.tagName === "P" && element.textContent?.includes("Open your") ? true : false,
  );
  const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node && !node.textContent?.includes(text)) node = walker.nextNode();
  if (!node) throw new Error(`"${text}" not found in one text node`);
  const start = node.textContent!.indexOf(text);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + text.length);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });
};

describe("edit-translation (Phase 8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.getSelection()?.removeAllRanges();
    vi.mocked(useSaveBlocksLanguageKey).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);
    vi.mocked(useGetTranslationSuggestion).mockReturnValue({
      isPending: false,
      mutateAsync: autoTranslateAsync,
    } as never);
    vi.mocked(languageManagerService.matchGlossary).mockImplementation(async (request) =>
      matchResponse(terms, request.text),
    );
  });

  describe("insert shortcut (H11, C6)", () => {
    it("describes the shortcut on the target field", async () => {
      renderModal();
      await screen.findByText("Workspace");
      const hint = document.getElementById(field().getAttribute("aria-describedby")!);
      expect(hint?.textContent).toBe("Press Alt+Shift+G to insert a glossary at the cursor.");
    });

    it("opens the term menu from the Insert glossary button", async () => {
      renderModal();
      fireEvent.click(await screen.findByRole("button", { name: /Insert glossary/ }));
      const option = await screen.findByRole("option", { name: /Workspace.*Arbeitsbereich/ });
      fireEvent.click(option);
      await waitFor(() => expect(field().value).toBe("Öffne Arbeitsbereich"));
    });

    it("hides the button and hint when no term has wording to insert", async () => {
      renderModal({
        ...keyDetails,
        resources: [
          { culture: "en-US", value: "Open the Portal" },
          { culture: "de-DE", value: "" },
        ],
      });
      await screen.findByText("Portal");
      expect(screen.queryByRole("button", { name: /Insert glossary/ })).toBeNull();
      expect(field().getAttribute("aria-describedby")).toBeNull();
    });

    it("lists the matched terms by rule and inserts the chosen value at the caret", async () => {
      renderModal();
      await screen.findByText("Workspace");
      const target = field();
      target.focus();
      target.setSelectionRange(6, 6);
      fireEvent.select(target);
      fireEvent.keyDown(target, { key: "˝", code: "KeyG", altKey: true, shiftKey: true });

      const option = await screen.findByRole("option", { name: /Workspace.*Arbeitsbereich/ });
      expect(screen.getByRole("option", { name: /SELISE.*SELISE/ })).toBeTruthy();
      expect(screen.queryByRole("option", { name: /Portal/ })).toBeNull();

      fireEvent.click(option);
      await waitFor(() => expect(field().value).toBe("Öffne Arbeitsbereich"));
    });

    it("hides Insert glossary once the translation uses every glossary (no duplicates)", async () => {
      renderModal({
        ...keyDetails,
        resources: [
          { culture: "en-US", value: "Go to Workspace" },
          { culture: "de-DE", value: "Gehe zum Arbeitsbereich" },
        ],
      });
      await screen.findByText("1 glossary · used in the translation");
      expect(screen.queryByRole("button", { name: /Insert glossary/ })).toBeNull();
      expect(field().getAttribute("aria-describedby")).toBeNull();

      // The shortcut still opens the menu, listing it as done.
      fireEvent.keyDown(field(), { code: "KeyG", altKey: true, shiftKey: true });
      const option = await screen.findByRole("option", { name: /Workspace.*Arbeitsbereich/ });
      expect(option.getAttribute("aria-disabled")).toBe("true");
      expect(screen.getByText("Already used")).toBeTruthy();
      fireEvent.click(option);
      expect(field().value).toBe("Gehe zum Arbeitsbereich");
    });

    it("brings Insert glossary back when the wording is removed", async () => {
      renderModal({
        ...keyDetails,
        resources: [
          { culture: "en-US", value: "Go to Workspace" },
          { culture: "de-DE", value: "Gehe zum Arbeitsbereich" },
        ],
      });
      await screen.findByText("1 glossary · used in the translation");
      fireEvent.change(field(), { target: { value: "Gehe zum Bereich" } });
      expect(await screen.findByRole("button", { name: /Insert glossary/ })).toBeTruthy();
      expect(screen.getByText("1 glossary · 1 not used yet")).toBeTruthy();
    });

    it("replaces untranslated source wording instead of appending", async () => {
      renderModal({
        ...keyDetails,
        resources: [
          { culture: "en-US", value: "Go to Workspace" },
          { culture: "de-DE", value: "Gehe zum Workspace" },
        ],
      });
      fireEvent.click(await screen.findByRole("button", { name: /Insert glossary/ }));
      fireEvent.click(await screen.findByRole("option", { name: /Workspace.*Arbeitsbereich/ }));
      await waitFor(() => expect(field().value).toBe("Gehe zum Arbeitsbereich"));
      expect(screen.queryByRole("button", { name: /Insert glossary/ })).toBeNull();
    });

    it("says so when the source has no glossary terms", async () => {
      renderModal({
        ...keyDetails,
        resources: [
          { culture: "en-US", value: "Hello" },
          { culture: "de-DE", value: "" },
        ],
      });
      fireEvent.keyDown(field(), { code: "KeyG", altKey: true, shiftKey: true });
      expect(await screen.findByText("No glossaries in the source")).toBeTruthy();
    });

    it("ignores G without Alt+Shift", () => {
      renderModal();
      fireEvent.keyDown(field(), { code: "KeyG", shiftKey: true });
      expect(screen.queryByText("No glossaries in the source")).toBeNull();
      expect(screen.queryByRole("option")).toBeNull();
    });
  });

  describe("Add to glossary (H14, C5)", () => {
    it("opens the editor with the selected source text as the name", async () => {
      renderModal();
      await screen.findByText("Workspace");
      selectSourceText("Open your");
      fireEvent.click(screen.getByRole("button", { name: "Add to glossary" }));
      expect(screen.getByText("sheet-Open your")).toBeTruthy();
    });

    it("is not offered for text that already is a glossary, in any letter case", async () => {
      renderModal();
      await screen.findByText("Workspace");
      selectSourceText("Workspace");
      expect(screen.queryByRole("button", { name: "Add to glossary" })).toBeNull();
    });

    it("is not offered while editing the default language", async () => {
      renderModal(keyDetails, "en-US");
      // The source block and the field both hold the English text.
      await screen.findAllByText(/Open your/);
      selectSourceText("Open your");
      expect(screen.queryByRole("button", { name: "Add to glossary" })).toBeNull();
    });

    it("shows nothing for a selection outside the source block", () => {
      renderModal();
      const outside = document.createElement("p");
      outside.textContent = "Elsewhere";
      document.body.appendChild(outside);
      const range = document.createRange();
      range.selectNodeContents(outside);
      document.getSelection()!.addRange(range);
      act(() => {
        document.dispatchEvent(new Event("selectionchange"));
      });
      expect(screen.queryByRole("button", { name: "Add to glossary" })).toBeNull();
      outside.remove();
    });
  });

  describe("applied terms (H25)", () => {
    it("shows which terms the AI applied and clears them on edit", async () => {
      autoTranslateAsync.mockResolvedValue({
        content: "Öffne deinen Arbeitsbereich im SELISE Portal",
        appliedTerms: [
          { glossaryId: "g1", term: "Workspace", rule: "translate", expected: "Arbeitsbereich" },
          { glossaryId: "g2", term: "SELISE", rule: "keep" },
        ],
        glossaryViolations: [],
      });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /Auto-Translate/ }));
      expect(
        await screen.findByText("Applied: Workspace → Arbeitsbereich, SELISE (kept)"),
      ).toBeTruthy();
      fireEvent.change(field(), { target: { value: "Öffne" } });
      expect(screen.queryByText(/^Applied:/)).toBeNull();
    });

    it("shows nothing when the response has no applied terms", async () => {
      autoTranslateAsync.mockResolvedValue({
        content: "Öffne",
        appliedTerms: [],
        glossaryViolations: [],
      });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /Auto-Translate/ }));
      await waitFor(() => expect(field().value).toBe("Öffne"));
      expect(screen.queryByText(/^Applied:/)).toBeNull();
    });
  });
});
