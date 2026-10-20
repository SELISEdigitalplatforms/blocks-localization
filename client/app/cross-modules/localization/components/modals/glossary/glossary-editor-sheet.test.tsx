import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui-kits/button/button";
import { showErrorToast, toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { IGlossary } from "@blocks-localization/models/language";
import GlossaryEditorSheet from "./glossary-editor-sheet";

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

const PREFIX = "@@glossary-meta:v1@@";

const existingGlossaries = [
  { itemId: "g1", name: "Workspace", createDate: "", lastUpdateDate: "" },
  { itemId: "g2", name: "Workspace2", createDate: "", lastUpdateDate: "" },
];

const makeGlossary = (overrides: Partial<IGlossary> = {}): IGlossary => ({
  itemId: "g1",
  name: "Workspace",
  language: "en-US",
  type: "",
  context: "",
  additionalNote: "",
  isGlobal: true,
  moduleIds: [],
  createDate: "",
  lastUpdateDate: "",
  ...overrides,
});

const renderSheet = (glossary?: IGlossary, onOpenChange = vi.fn()) =>
  render(<GlossaryEditorSheet open onOpenChange={onOpenChange} glossary={glossary} />);

const nameInput = () => screen.getByPlaceholderText("Enter glossary name");
const typeName = (value: string) => fireEvent.change(nameInput(), { target: { value } });
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));
const lastPayload = () => saveGlossaryAsync.mock.calls.at(-1)?.[0];

const addChip = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
};

const openForbidden = (code: string) => {
  const row = screen.getByLabelText((label) => label.endsWith(`(${code})`)).closest("div")!;
  fireEvent.click(within(row).getByRole("button", { name: /Forbidden alternatives/ }));
};

describe("modals/glossary/glossary-editor-sheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveGlossaryAsync.mockResolvedValue({ success: true });
    vi.mocked(hooks.useSaveGlossary).mockReturnValue({
      isPending: false,
      mutateAsync: saveGlossaryAsync,
    } as never);
    vi.mocked(hooks.useGetLanguages).mockReturnValue({
      data: [
        { itemId: "1", languageCode: "en-US", languageName: "English", isDefault: true },
        { itemId: "2", languageCode: "de-DE", languageName: "German" },
        { itemId: "3", languageCode: "fr-FR", languageName: "French" },
      ],
    } as never);
    vi.mocked(hooks.useGetLanguageModules).mockReturnValue({
      data: [
        { itemId: "m1", moduleName: "UILM" },
        { itemId: "m2", moduleName: "Billing" },
      ],
    } as never);
    vi.mocked(hooks.useSearchGlossaries).mockReturnValue({
      data: { items: existingGlossaries, totalCount: 2 },
      isError: false,
    } as never);
  });

  it("should open a right-side sheet with the sections in order (H1)", () => {
    renderSheet();
    expect(screen.getByRole("heading", { name: "Add Glossary" })).toBeTruthy();
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Term", "Translations", "Meaning", "Scope"]);
    const scope = screen.getByRole("heading", { name: "Scope" });
    const note = screen.getByRole("button", { name: "Internal Note" });
    expect(scope.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("dialog").className).toContain("sm:max-w-xl");
  });

  it("should show one translation row per non-default language (H2)", () => {
    renderSheet();
    expect(screen.getByLabelText("German (de-DE)")).toBeTruthy();
    expect(screen.getByLabelText("French (fr-FR)")).toBeTruthy();
    expect(screen.queryByLabelText("English (en-US)")).toBeNull();
  });

  it("should send the metadata and context of Example 2 (H3)", async () => {
    renderSheet();
    typeName("Workspace new");
    fireEvent.change(screen.getByLabelText("German (de-DE)"), {
      target: { value: "Arbeitsbereich" },
    });
    fireEvent.change(screen.getByLabelText("French (fr-FR)"), {
      target: { value: "Espace de travail" },
    });
    openForbidden("de-DE");
    addChip(screen.getByLabelText("Forbidden alternatives for German (de-DE)"), "Werkbereich");
    fireEvent.change(screen.getByPlaceholderText("What the term means"), {
      target: { value: "A container for projects shared by a team." },
    });
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload()).toEqual({
      name: "Workspace new",
      language: "",
      type: "",
      context:
        "A container for projects shared by a team. ⟦rule: de-DE→Arbeitsbereich; fr-FR→Espace de travail; avoid de-DE: Werkbereich⟧",
      additionalNote: `${PREFIX}{"rule":"translate","translations":{"de-DE":"Arbeitsbereich","fr-FR":"Espace de travail"},"forbidden":{"de-DE":["Werkbereich"]}}`,
      isGlobal: true,
      moduleIds: [],
    });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Glossary item added successfully." }),
    );
  });

  it("should open a plain-text note as Translate with the note unchanged (H4)", () => {
    renderSheet(makeGlossary({ additionalNote: "legacy note" }));
    expect(screen.getByRole("heading", { name: "Edit Glossary" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Translate" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect((screen.getByLabelText("Additional note") as HTMLTextAreaElement).value).toBe(
      "legacy note",
    );
  });

  it("should save an unchanged structured term byte-identically and keep unknown cultures (H5, C3)", async () => {
    const additionalNote = `${PREFIX}{"rule":"translate","caseSensitive":true,"variants":["workspaces"],"translations":{"de-DE":"Arbeitsbereich","it-IT":"Area di lavoro"},"forbidden":{"de-DE":["Werkbereich"]},"note":"n"}`;
    renderSheet(makeGlossary({ additionalNote }));
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload().additionalNote).toBe(additionalNote);
    expect(lastPayload().itemId).toBe("g1");
  });

  it("should warn about corrupt data, pre-fill the raw note and save fresh JSON (C1)", async () => {
    const raw = `${PREFIX}{broken`;
    renderSheet(makeGlossary({ additionalNote: raw }));
    expect(
      screen.getByText("Stored terminology data could not be read. Saving will replace it."),
    ).toBeTruthy();
    expect((screen.getByLabelText("Additional note") as HTMLTextAreaElement).value).toBe(raw);
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    const saved: string = lastPayload().additionalNote;
    expect(saved.startsWith(PREFIX)).toBe(true);
    expect(JSON.parse(saved.slice(PREFIX.length))).toEqual({ rule: "translate", note: raw });
  });

  it("should disable editing for an unsupported version (C2)", () => {
    renderSheet(makeGlossary({ additionalNote: "@@glossary-meta:v2@@{}" }));
    expect(
      screen.getByText("This term was saved by a newer version and can't be edited here."),
    ).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect((nameInput().closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
  });

  it("should hide translations for Keep and write the keep marker (H10)", async () => {
    renderSheet(makeGlossary({ name: "SELISE" }));
    fireEvent.click(screen.getByRole("radio", { name: "Keep" }));
    expect(screen.queryByRole("heading", { name: "Translations" })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("What the term means"), {
      target: { value: "Company name." },
    });
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload().context).toBe("Company name. ⟦rule: keep as-is in all languages⟧");
  });

  it("should show only forbidden alternatives for the Forbidden rule", async () => {
    renderSheet(makeGlossary());
    fireEvent.click(screen.getByRole("radio", { name: "Forbidden" }));
    expect(screen.queryByPlaceholderText("Approved translation")).toBeNull();
    addChip(screen.getByLabelText("Forbidden alternatives for German (de-DE)"), "Werkraum");
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload().context).toBe("⟦rule: do not use this term; avoid de-DE: Werkraum⟧");
  });

  it("should not show Variants or Case-sensitive and keep their stored values on save", async () => {
    const additionalNote = `${PREFIX}{"rule":"translate","caseSensitive":true,"variants":["workspaces"],"translations":{"de-DE":"Arbeitsbereich"}}`;
    renderSheet(makeGlossary({ additionalNote }));
    expect(screen.queryByLabelText("Variants")).toBeNull();
    expect(screen.queryByText("Case-sensitive")).toBeNull();
    fireEvent.change(screen.getByLabelText("German (de-DE)"), { target: { value: "Arbeitsraum" } });
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    const saved = JSON.parse(lastPayload().additionalNote.slice(PREFIX.length));
    expect(saved.caseSensitive).toBe(true);
    expect(saved.variants).toEqual(["workspaces"]);
    expect(saved.translations["de-DE"]).toBe("Arbeitsraum");
  });

  it("should block a forbidden alternative equal to the translation (C5)", async () => {
    renderSheet(makeGlossary());
    fireEvent.change(screen.getByLabelText("German (de-DE)"), {
      target: { value: "Arbeitsbereich" },
    });
    openForbidden("de-DE");
    addChip(screen.getByLabelText("Forbidden alternatives for German (de-DE)"), "arbeitsbereich");
    save();
    expect(await screen.findByText("A translation can't also be forbidden")).toBeTruthy();
    expect(saveGlossaryAsync).not.toHaveBeenCalled();
  });

  it("should block saving more than 20,000 characters of terminology data (C6)", async () => {
    renderSheet(
      makeGlossary({
        additionalNote: `${PREFIX}{"rule":"translate","translations":{"it-IT":"${"x".repeat(20000)}"}}`,
      }),
    );
    save();
    expect(await screen.findByText("Too much terminology data for one term")).toBeTruthy();
    expect(saveGlossaryAsync).not.toHaveBeenCalled();
  });

  it("should strip marker characters from the context only (C8)", async () => {
    renderSheet(makeGlossary());
    fireEvent.change(screen.getByLabelText("German (de-DE)"), {
      target: { value: 'A;B→"C"' },
    });
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload().context).toBe("⟦rule: de-DE→A B C⟧");
    expect(JSON.parse(lastPayload().additionalNote.slice(PREFIX.length)).translations).toEqual({
      "de-DE": 'A;B→"C"',
    });
  });

  it("should load the definition without the marker and save exactly one marker (C9)", async () => {
    renderSheet(
      makeGlossary({
        context: "A container. ⟦rule: de-DE→Alt⟧",
        additionalNote: `${PREFIX}{"rule":"translate","translations":{"de-DE":"Neu"}}`,
      }),
    );
    expect((screen.getByPlaceholderText("What the term means") as HTMLTextAreaElement).value).toBe(
      "A container.",
    );
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload().context).toBe("A container. ⟦rule: de-DE→Neu⟧");
  });

  it("should save no marker when Translate has no data (C10)", async () => {
    renderSheet(makeGlossary({ context: "Plain definition" }));
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload().context).toBe("Plain definition");
  });

  it("should keep the sheet open with values when the server rejects the save (C11)", async () => {
    saveGlossaryAsync.mockResolvedValue({
      success: false,
      validationErrors: [{ errorMessage: "Name already exists" }],
    });
    const onOpenChange = vi.fn();
    renderSheet(undefined, onOpenChange);
    typeName("Duplicate");
    save();
    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "Name already exists" }),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect((nameInput() as HTMLInputElement).value).toBe("Duplicate");
  });

  it("should map scope to isGlobal and moduleIds (H11, C12)", async () => {
    renderSheet(makeGlossary());
    fireEvent.click(screen.getByRole("radio", { name: "Specific modules" }));
    save();
    expect(await screen.findByText("Select at least one module")).toBeTruthy();
    expect(saveGlossaryAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("combobox", { name: /Tag modules/ }));
    fireEvent.click(await screen.findByRole("option", { name: "Billing" }));
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({ isGlobal: false, moduleIds: ["m2"] });
  });

  it("should warn before dropping module links of a legacy global term", async () => {
    renderSheet(makeGlossary({ isGlobal: true, moduleIds: ["m1", "m2"] }));
    expect(
      screen.getByText(/Also linked to 2 modules\. Saving as Whole project removes those links\./),
    ).toBeTruthy();
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({ isGlobal: true, moduleIds: [] });
  });

  it("should open a non-global term without modules as Specific modules", () => {
    renderSheet(makeGlossary({ isGlobal: false, moduleIds: [] }));
    expect(
      screen.getByRole("radio", { name: "Specific modules" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("should validate definition and note length", async () => {
    renderSheet(makeGlossary());
    fireEvent.change(screen.getByPlaceholderText("What the term means"), {
      target: { value: "x".repeat(1001) },
    });
    save();
    expect(await screen.findByText("Definition must be 1,000 characters or fewer")).toBeTruthy();
    expect(saveGlossaryAsync).not.toHaveBeenCalled();
  });

  it("should discard changes on close and return focus to the trigger (C13)", async () => {
    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <GlossaryEditorSheet
          open={open}
          onOpenChange={setOpen}
          glossary={makeGlossary()}
          trigger={<Button>Edit</Button>}
        />
      );
    };
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(trigger);
    typeName("Changed");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    fireEvent.click(trigger);
    expect((nameInput() as HTMLInputElement).value).toBe("Workspace");
    expect(saveGlossaryAsync).not.toHaveBeenCalled();
  });

  it("should toast a thrown save error", async () => {
    saveGlossaryAsync.mockRejectedValue(new Error("x"));
    renderSheet(makeGlossary());
    save();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  describe("duplicate name warning", () => {
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
      renderSheet();
      typeName("workspace ");
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(screen.queryByText(/already exists/)).toBeNull();
      await waitForDebounce();
      expect(hooks.useSearchGlossaries).toHaveBeenLastCalledWith("workspace", true);
      expect(screen.getByText(/'Workspace' already exists/)).toBeTruthy();
    });

    it("should not warn for a partial match or a superseded name", async () => {
      renderSheet();
      typeName("Works");
      await waitForDebounce();
      expect(screen.queryByText(/already exists/)).toBeNull();
      typeName("Workspace");
      expect(hooks.useSearchGlossaries).toHaveBeenLastCalledWith("Works", false);
    });

    it("should navigate to the existing glossary from 'Open it'", async () => {
      const onOpenChange = vi.fn();
      renderSheet(undefined, onOpenChange);
      typeName("WORKSPACE2");
      await waitForDebounce();
      fireEvent.click(screen.getByRole("button", { name: "Open it" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(navigate).toHaveBeenCalledWith("/scoped/services/glossary/g2");
    });

    it("should not warn when the match is the glossary being edited", async () => {
      renderSheet(makeGlossary());
      await waitForDebounce();
      expect(screen.queryByText(/already exists/)).toBeNull();
    });

    it("should show nothing when the check fails", async () => {
      vi.mocked(hooks.useSearchGlossaries).mockReturnValue({
        data: undefined,
        isError: true,
      } as never);
      renderSheet();
      typeName("Workspace");
      await waitForDebounce();
      expect(screen.queryByText(/already exists/)).toBeNull();
    });

    it("should not block submit when a duplicate is shown", async () => {
      renderSheet();
      typeName("workspace");
      await waitForDebounce();
      expect(screen.getByText(/already exists/)).toBeTruthy();
      vi.useRealTimers();
      save();
      await waitFor(() =>
        expect(saveGlossaryAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: "workspace" }),
        ),
      );
    });
  });
});
