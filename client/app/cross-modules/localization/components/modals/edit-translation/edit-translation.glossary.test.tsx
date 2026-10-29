import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { toast } from "@/hooks/use-toast";
import {
  useGetTranslationSuggestion,
  useSaveBlocksLanguageKey,
} from "@blocks-localization/hooks/use-language-manager";
import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import {
  IBlocksLanguageKey,
  IGlossary,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { matchResponse } from "@blocks-localization/test-utils/helpers/glossary-matches";
import EditTranslation from "./edit-translation";

const saveKeyAsync = vi.fn();
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

const G1: IGlossary = {
  itemId: "g1",
  name: "Workspace",
  isGlobal: true,
  createDate: "",
  lastUpdateDate: "",
  additionalNote:
    GLOSSARY_META_PREFIX +
    JSON.stringify({
      rule: "translate",
      translations: { "de-DE": "Arbeitsbereich" },
      forbidden: { "de-DE": ["Werkbereich"] },
    }),
};

const matchGlossary = vi.mocked(languageManagerService.matchGlossary);

const APPLIED_G1 = [
  { glossaryId: "g1", term: "Workspace", rule: "translate", expected: "Arbeitsbereich" },
];
const serverReply = (content: string, glossaryViolations: object[] = []) => ({
  content,
  appliedTerms: APPLIED_G1,
  glossaryViolations,
});
const MISSING = {
  glossaryId: "g1",
  term: "Workspace",
  kind: "missing-translation",
  expected: "Arbeitsbereich",
};
const FORBIDDEN = {
  glossaryId: "g1",
  term: "Workspace",
  kind: "forbidden-used",
  found: "Werkbereich",
};

const keyDetails: IBlocksLanguageKey = {
  itemId: "key-1",
  keyName: "ws",
  moduleId: "M",
  routes: [],
  glossaryIds: ["g9"],
  resources: [
    { culture: "en-US", value: "Open your Workspace" },
    { culture: "de-DE", value: "" },
  ],
  isPartiallyTranslated: false,
  lastUpdateDate: "",
  createDate: "",
  context: "Button label",
};

// Not default-first: the modal must not rely on View Details sorting the cached list (C20).
const unsortedLanguages: ILanguageConfig[] = [
  { itemId: "l2", languageName: "German", languageCode: "de-DE" },
  { itemId: "l1", languageName: "English", languageCode: "en-US", isDefault: true },
];

const renderModal = (props: Partial<React.ComponentProps<typeof EditTranslation>> = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (open: boolean) => (
    <QueryClientProvider client={queryClient}>
      <Dialog open={open}>
        {open && (
          <EditTranslation
            dialogTitle="Edit translation"
            keyDetails={keyDetails}
            destinationLanguageCode="de-DE"
            languageListData={unsortedLanguages}
            onClose={vi.fn()}
            {...props}
          />
        )}
      </Dialog>
    </QueryClientProvider>
  );
  const view = render(ui(true));
  return { ...view, close: () => view.rerender(ui(false)), reopen: () => view.rerender(ui(true)) };
};

const field = () => screen.getByPlaceholderText("Enter translation") as HTMLTextAreaElement;
const autoTranslateButton = () =>
  screen.getByRole("button", { name: /Auto-Translate/ }) as HTMLButtonElement;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

/**
 * No violation list and no info line. The polite live region stays mounted while empty, so
 * this checks that every status region is empty instead of that none exists.
 */
const expectNoStatusContent = () =>
  expect(screen.queryAllByRole("status").filter((region) => region.textContent !== "")).toEqual([]);

describe("edit-translation — glossary-aware suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSaveBlocksLanguageKey).mockReturnValue({
      isPending: false,
      mutateAsync: saveKeyAsync,
    } as never);
    vi.mocked(useGetTranslationSuggestion).mockReturnValue({
      isPending: false,
      mutateAsync: autoTranslateAsync,
    } as never);
    matchGlossary.mockImplementation(async (request) => matchResponse([G1], request.text));
  });

  describe("glossary-aware", () => {
    it("sends one request with the key's context, tags, module and languages (H4, C14)", async () => {
      autoTranslateAsync.mockResolvedValue(serverReply("Öffnen Sie Ihren Arbeitsbereich"));
      renderModal();

      fireEvent.click(autoTranslateButton());
      await waitFor(() => expect(field().value).toBe("Öffnen Sie Ihren Arbeitsbereich"));
      expect(autoTranslateAsync).toHaveBeenCalledTimes(1);
      expect(autoTranslateAsync.mock.calls[0][0]).toStrictEqual({
        sourceText: "Open your Workspace",
        destinationLanguage: "German",
        currentLanguage: "English",
        currentLanguageCode: "en-US",
        temperature: 0.1,
        elementDetailContext: "Button label",
        glossaryIds: ["g9"],
        moduleId: "M",
        destinationLanguageCode: "de-DE",
      });
      expectNoStatusContent();
    });

    it("lists the server's violations, keeps Save enabled and applies Fix (H5, C20)", async () => {
      autoTranslateAsync.mockResolvedValue(
        serverReply("Öffnen Sie Ihren Werkbereich", [MISSING, FORBIDDEN]),
      );
      renderModal();

      fireEvent.click(autoTranslateButton());
      await screen.findByText('"Werkbereich" is not allowed');
      expect(autoTranslateAsync).toHaveBeenCalledTimes(1);
      expect(field().value).toBe("Öffnen Sie Ihren Werkbereich");
      expect(screen.getByText('Expected "Arbeitsbereich" for "Workspace"')).toBeTruthy();
      expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
      expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(
        false,
      );

      fireEvent.click(screen.getByRole("button", { name: "Fix" }));
      expect(field().value).toBe("Öffnen Sie Ihren Arbeitsbereich");
      // The fixed text has neither the forbidden word nor the missing value any more.
      expectNoStatusContent();
    });

    it("shows the content without a list when the server returns empty arrays (C1)", async () => {
      autoTranslateAsync.mockResolvedValue({
        content: "Öffnen Sie Ihren Werkbereich",
        appliedTerms: [],
        glossaryViolations: [],
      });
      renderModal();
      fireEvent.click(autoTranslateButton());
      await waitFor(() => expect(field().value).toBe("Öffnen Sie Ihren Werkbereich"));
      expectNoStatusContent();
    });

    it("places Retry and Fix right after the textarea in tab order", async () => {
      autoTranslateAsync.mockResolvedValue(
        serverReply("Öffnen Sie Ihren Werkbereich", [MISSING, FORBIDDEN]),
      );
      renderModal();
      fireEvent.click(autoTranslateButton());
      const fix = await screen.findByRole("button", { name: "Fix" });
      const retry = screen.getByRole("button", { name: "Retry" });
      const focusable = [
        ...document.querySelectorAll<HTMLElement>("button:not([disabled]), textarea"),
      ];
      const at = focusable.indexOf(field());
      expect(focusable.slice(at + 1, at + 3)).toEqual([retry, fix]);
    });

    it("clears the list when the user edits the text; saving proceeds (C11)", async () => {
      autoTranslateAsync.mockResolvedValue(
        serverReply("Öffnen Sie Ihren Werkbereich", [MISSING, FORBIDDEN]),
      );
      saveKeyAsync.mockResolvedValue({ success: true });
      renderModal();

      fireEvent.click(autoTranslateButton());
      await screen.findByText('Expected "Arbeitsbereich" for "Workspace"');
      fireEvent.change(field(), { target: { value: "Öffnen Sie Ihren Werkbereich!" } });
      expect(screen.queryByText('Expected "Arbeitsbereich" for "Workspace"')).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });
      expect(saveKeyAsync).toHaveBeenCalledTimes(1);
    });

    it("Retry re-sends one request and shows what remains (C20)", async () => {
      autoTranslateAsync
        .mockResolvedValueOnce(serverReply("Öffnen Sie Ihren Bereich", [MISSING]))
        .mockResolvedValueOnce(serverReply("Öffnen Sie Ihren Arbeitsbereich"));
      renderModal();

      fireEvent.click(autoTranslateButton());
      await screen.findByText('Expected "Arbeitsbereich" for "Workspace"');
      expect(screen.queryByRole("button", { name: "Fix" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(field().value).toBe("Öffnen Sie Ihren Arbeitsbereich"));
      expect(autoTranslateAsync).toHaveBeenCalledTimes(2);
      expectNoStatusContent();
    });

    it("offers Retry, not Fix, for a forbidden word of a term without an expected value (C20)", async () => {
      autoTranslateAsync.mockResolvedValue({
        content: "Öffnen Sie Ihren Werkbereich",
        appliedTerms: [{ glossaryId: "g1", term: "Workspace", rule: "keep" }],
        glossaryViolations: [FORBIDDEN],
      });
      renderModal();
      fireEvent.click(autoTranslateButton());
      await screen.findByText('"Werkbereich" is not allowed');
      expect(screen.queryByRole("button", { name: "Fix" })).toBeNull();
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    });

    it("disables Auto-Translate while running and ignores a response after close", async () => {
      const pending = deferred<{ content: string }>();
      autoTranslateAsync.mockReturnValue(pending.promise);
      const { close } = renderModal();

      fireEvent.click(autoTranslateButton());
      await waitFor(() => expect(autoTranslateAsync).toHaveBeenCalledTimes(1));
      expect(autoTranslateButton().disabled).toBe(true);

      // Closing the modal unmounts it.
      close();
      await act(async () => {
        pending.resolve({ content: "Öffnen Sie Ihren Arbeitsbereich" });
      });
      expect(autoTranslateAsync).toHaveBeenCalledTimes(1);
      expect(toast).not.toHaveBeenCalled();
    });
  });

  describe("highlights and live checks (Phase 4)", () => {
    // A fresh key: saving mutates the caller's keyDetails in place (existing contract).
    const freshKey = (): IBlocksLanguageKey => ({
      ...keyDetails,
      resources: [
        { culture: "en-US", value: "Open your Workspace" },
        { culture: "de-DE", value: "" },
      ],
    });
    const renderFresh = (props: Partial<React.ComponentProps<typeof EditTranslation>>) =>
      renderModal({ keyDetails: freshKey(), ...props });
    const highlight = (name: string) =>
      screen.findByRole("button", { name: new RegExp(`^Glossary term ${name}`) });

    it("requests /Glossary/Match once with the key and reuses it when reopened (H6, C11)", async () => {
      const { close, reopen } = renderFresh({});
      await highlight("Workspace");
      expect(matchGlossary).toHaveBeenCalledTimes(1);
      expect(matchGlossary.mock.calls[0][0]).toEqual({
        text: "Open your Workspace",
        language: "en-US",
        keyId: "key-1",
        moduleId: "M",
        glossaryIds: ["g9"],
      });
      close();
      reopen();
      await highlight("Workspace");
      expect(matchGlossary).toHaveBeenCalledTimes(1);
    });

    it("highlights a Draft term with its notice (H7)", async () => {
      matchGlossary.mockImplementation(async (request) =>
        matchResponse([{ ...G1, status: "draft" }], request.text),
      );
      renderFresh({});
      fireEvent.click(await highlight("Workspace"));
      expect(await screen.findByText("Draft: not sent to the AI")).toBeTruthy();
    });

    it("labels and highlights the isDefault source even when it is listed second (C20, H1)", async () => {
      renderFresh({});
      expect(screen.getByText("English (default)")).toBeTruthy();
      expect((await highlight("Workspace")).textContent).toBe("Workspace");
      expect(screen.getByText(/Open your/).textContent).toBe("Open your Workspace");
    });

    it("says the terms have approved wording when the glossary has it", async () => {
      renderFresh({});
      await highlight("Workspace");
      expect(screen.getByText("1 glossary term · select to see the approved wording")).toBeTruthy();
    });

    it("is honest when the glossary has no wording for the target language", async () => {
      renderFresh({
        destinationLanguageCode: "bn-BD",
        languageListData: [
          ...unsortedLanguages,
          { itemId: "l3", languageName: "Bengali", languageCode: "bn-BD" },
        ],
      });
      expect((await highlight("Workspace")).getAttribute("aria-label")).toBe(
        "Glossary term Workspace: Translate, no Bengali wording in the glossary",
      );
      expect(
        screen.getByText("1 glossary term · no Bengali wording in the glossary yet"),
      ).toBeTruthy();
    });

    it("shows plain source text when editing the default language itself", async () => {
      renderFresh({ destinationLanguageCode: "en-US" });
      await waitFor(() => expect(matchGlossary).toHaveBeenCalled());
      await act(async () => {});
      expect(screen.queryByRole("button", { name: /Glossary term/ })).toBeNull();
      expect(screen.queryByText(/glossary term/)).toBeNull();
    });

    it("skips /Glossary/Match for a source over 5,000 characters (C4)", async () => {
      renderModal({
        keyDetails: {
          ...keyDetails,
          resources: [
            { culture: "en-US", value: `Workspace ${"a".repeat(5000)}` },
            { culture: "de-DE", value: "" },
          ],
        },
      });
      await act(async () => {});
      expect(matchGlossary).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: /Glossary term/ })).toBeNull();
    });

    it("renders plain source text without toasts when /Glossary/Match fails (C2)", async () => {
      matchGlossary.mockRejectedValue(new Error("down"));
      renderFresh({});
      await waitFor(() => expect(matchGlossary).toHaveBeenCalled());
      await act(async () => {});
      expect(screen.queryByRole("button", { name: /Glossary term/ })).toBeNull();
      expect(toast).not.toHaveBeenCalled();
    });

    it("inserts the approved translation into the target and focuses it (H3)", async () => {
      renderFresh({});
      fireEvent.click(await highlight("Workspace"));
      fireEvent.click(await screen.findByRole("button", { name: "Insert" }));
      expect(field().value).toBe("Arbeitsbereich");
      expect(document.activeElement).toBe(field());
    });

    it("warns while typing, keeps Save enabled and Fix recomputes at once (H5, H6, C6)", async () => {
      renderFresh({});
      await highlight("Workspace");
      fireEvent.change(field(), { target: { value: "Öffnen Sie Ihren Werkbereich" } });
      expect(await screen.findByText('"Werkbereich" is not allowed')).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
      expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
      fireEvent.click(screen.getByRole("button", { name: "Fix" }));
      expect(field().value).toBe("Öffnen Sie Ihren Arbeitsbereich");
      expectNoStatusContent();
    });

    it("shows no live warnings for an empty target (C5)", async () => {
      renderFresh({});
      await highlight("Workspace");
      fireEvent.change(field(), { target: { value: "Werkbereich" } });
      await screen.findByText('"Werkbereich" is not allowed');
      fireEvent.change(field(), { target: { value: "" } });
      expectNoStatusContent();
    });

    it("hands the suggestion's list (with Retry) over to the live list on the first edit (C21)", async () => {
      autoTranslateAsync.mockResolvedValue(
        serverReply("Öffnen Sie Ihren Werkbereich", [MISSING, FORBIDDEN]),
      );
      renderFresh({});
      fireEvent.click(autoTranslateButton());
      await screen.findByText('"Werkbereich" is not allowed');
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();

      fireEvent.change(field(), { target: { value: "Ihr Werkbereich" } });
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
      expect(await screen.findByText('"Werkbereich" is not allowed')).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
      expect(screen.getByRole("button", { name: "Fix" })).toBeTruthy();
    });
  });
});
