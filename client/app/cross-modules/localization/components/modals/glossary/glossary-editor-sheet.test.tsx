import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui-kits/button/button";
import { showErrorToast, toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { IGlossary } from "@blocks-localization/models/language";
import GlossaryEditorSheet from "./glossary-editor-sheet";

const saveGlossaryAsync = vi.fn();
const fetchLatestGlossary = vi.fn();
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
  useFetchLatestGlossary: vi.fn(),
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
  const row = screen
    .getByLabelText((label) => label.endsWith(`(${code})`))
    .closest<HTMLElement>("div.grid")!;
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
    vi.mocked(hooks.useFetchLatestGlossary).mockReturnValue(fetchLatestGlossary);
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

  it("should send the structured fields of Example 1, with no marker or JSON (H1, H2)", async () => {
    renderSheet();
    typeName("Workspace new");
    fireEvent.change(screen.getByLabelText("German (de-DE)"), {
      target: { value: " Arbeitsbereich " },
    });
    fireEvent.change(screen.getByLabelText("French (fr-FR)"), {
      target: { value: "Espace de travail" },
    });
    openForbidden("de-DE");
    addChip(screen.getByLabelText("Forbidden alternatives for German (de-DE)"), "Werkbereich");
    fireEvent.change(screen.getByPlaceholderText("What the term means"), {
      target: { value: "A container for projects shared by a team. " },
    });
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload()).toEqual({
      name: "Workspace new",
      // A new term starts in the project default language (Phase 8 H9).
      language: "en-US",
      type: "",
      context: "A container for projects shared by a team.",
      additionalNote: "",
      isGlobal: true,
      moduleIds: [],
      rule: "translate",
      caseSensitive: false,
      variants: [],
      translations: [
        { language: "de-DE", value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] },
        { language: "fr-FR", value: "Espace de travail", forbiddenValues: [] },
      ],
      status: "approved",
      partOfSpeech: "",
      usageExamples: [],
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

  it("should send back unknown cultures and inactive values unchanged (C6)", async () => {
    renderSheet(
      makeGlossary({
        rule: "keep",
        caseSensitive: true,
        variants: ["workspaces"],
        translations: [
          { language: "de-DE", value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] },
          { language: "it-IT", value: "Area di lavoro", forbiddenValues: [] },
        ],
        additionalNote: "n",
        version: 3,
      }),
    );
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({
      itemId: "g1",
      rule: "keep",
      caseSensitive: true,
      variants: ["workspaces"],
      translations: [
        { language: "de-DE", value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] },
        { language: "it-IT", value: "Area di lavoro", forbiddenValues: [] },
      ],
      additionalNote: "n",
      version: 3,
    });
  });

  it("should open a legacy term with the API fields and the note from its JSON (H3, Example 2)", async () => {
    renderSheet(
      makeGlossary({
        schemaVersion: 0,
        context: "A container. ⟦rule: de-DE→Arbeitsbereich⟧",
        additionalNote: `${PREFIX}{"rule":"translate","translations":{"de-DE":"Alt"},"note":"From JSON"}`,
        rule: "translate",
        variants: ["workspaces"],
        translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: [] }],
      }),
    );
    expect((screen.getByLabelText("German (de-DE)") as HTMLInputElement).value).toBe(
      "Arbeitsbereich",
    );
    expect(screen.getByText("workspaces")).toBeTruthy();
    expect((screen.getByLabelText("Additional note") as HTMLTextAreaElement).value).toBe(
      "From JSON",
    );
    expect((screen.getByPlaceholderText("What the term means") as HTMLTextAreaElement).value).toBe(
      "A container.",
    );
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({
      context: "A container.",
      additionalNote: "From JSON",
      translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: [] }],
    });
  });

  it("should warn about corrupt data, pre-fill the raw note and save it as plain text (C1)", async () => {
    const raw = `${PREFIX}{broken`;
    renderSheet(makeGlossary({ additionalNote: raw }));
    expect(
      screen.getByText("Stored terminology data could not be read. Saving will replace it."),
    ).toBeTruthy();
    expect((screen.getByLabelText("Additional note") as HTMLTextAreaElement).value).toBe(raw);
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({ additionalNote: raw, rule: "translate" });
  });

  it("should disable editing for an unsupported version (C2)", () => {
    renderSheet(makeGlossary({ additionalNote: "@@glossary-meta:v2@@{}" }));
    expect(
      screen.getByText("This term was saved by a newer version and can't be edited here."),
    ).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect((nameInput().closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
  });

  it("should hide translations for Keep and save the rule without a marker (H10)", async () => {
    renderSheet(makeGlossary({ name: "SELISE" }));
    fireEvent.click(screen.getByRole("radio", { name: "Keep" }));
    expect(screen.queryByRole("heading", { name: "Translations" })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("What the term means"), {
      target: { value: "Company name." },
    });
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({ context: "Company name.", rule: "keep" });
  });

  it("should show only forbidden alternatives for the Forbidden rule", async () => {
    renderSheet(makeGlossary());
    fireEvent.click(screen.getByRole("radio", { name: "Forbidden" }));
    expect(screen.queryByPlaceholderText("Approved translation")).toBeNull();
    addChip(screen.getByLabelText("Forbidden alternatives for German (de-DE)"), "Werkraum");
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({
      context: "",
      rule: "forbidden",
      translations: [{ language: "de-DE", value: "", forbiddenValues: ["Werkraum"] }],
    });
  });

  describe("status", () => {
    const statusTrigger = () => screen.getByRole("combobox", { name: "Status" });

    it("should show the Status select after Rule with its helper text, Approved on create (H2)", () => {
      renderSheet();
      expect(statusTrigger().textContent).toContain("Approved");
      expect(screen.getByText("Only Approved terms are sent to the AI.")).toBeTruthy();
      const keep = screen.getByRole("radio", { name: "Keep" });
      expect(
        keep.compareDocumentPosition(statusTrigger()) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        statusTrigger().compareDocumentPosition(
          screen.getByRole("switch", { name: "Case-sensitive" }),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("should load the stored status and save a changed one", async () => {
      renderSheet(makeGlossary({ status: "draft" }));
      expect(statusTrigger().textContent).toContain("Draft");
      fireEvent.click(statusTrigger());
      fireEvent.click(await screen.findByRole("option", { name: "Deprecated" }));
      save();
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
      expect(lastPayload().status).toBe("deprecated");
    });

    it("should open a legacy term without a status as Approved", async () => {
      renderSheet(makeGlossary());
      save();
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
      expect(lastPayload().status).toBe("approved");
    });
  });

  it("should show the server error and keep the sheet open without glossary::save (C13)", async () => {
    saveGlossaryAsync.mockResolvedValue({ success: false, errorMessage: "Forbidden" });
    const onOpenChange = vi.fn();
    renderSheet(makeGlossary(), onOpenChange);
    save();
    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith({ errors: "Forbidden" }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  describe("variants and case-sensitive", () => {
    const savedMeta = () => lastPayload();

    it("should add variants with Enter, comma or leaving the field as removable chips (H13)", async () => {
      renderSheet(makeGlossary());
      const input = screen.getByLabelText("Variants");
      expect(input.id).toBe("glossary-variants");
      expect(input.getAttribute("placeholder")).toBe("Plurals, synonyms… press Enter or comma");
      addChip(input, "workspaces");
      fireEvent.change(input, { target: { value: "work area,team space," } });
      fireEvent.change(input, { target: { value: "work room" } });
      fireEvent.blur(input);
      expect(screen.getByText("workspaces")).toBeTruthy();
      expect(screen.getByText("work area")).toBeTruthy();
      expect(screen.getByText("work room")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Remove variant work area" }));
      expect(screen.queryByText("work area")).toBeNull();
      save();
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
      expect(savedMeta().variants).toEqual(["workspaces", "team space", "work room"]);
    });

    it("should show the Case-sensitive switch after Rule and save it (H14)", async () => {
      renderSheet(makeGlossary());
      const toggle = screen.getByRole("switch", { name: "Case-sensitive" });
      const keep = screen.getByRole("radio", { name: "Keep" });
      expect(keep.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(
        toggle.compareDocumentPosition(screen.getByLabelText("Variants")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(toggle.getAttribute("aria-checked")).toBe("false");
      fireEvent.click(toggle);
      save();
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
      expect(savedMeta().caseSensitive).toBe(true);
    });

    it("should load stored values and save edits to them (H13, H14)", async () => {
      renderSheet(makeGlossary({ caseSensitive: true, variants: ["workspaces"] }));
      const toggle = screen.getByRole("switch", { name: "Case-sensitive" });
      expect(toggle.getAttribute("aria-checked")).toBe("true");
      expect(screen.getByText("workspaces")).toBeTruthy();
      fireEvent.click(toggle);
      fireEvent.click(screen.getByRole("button", { name: "Remove variant workspaces" }));
      save();
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
      const saved = savedMeta();
      expect(saved.caseSensitive ?? false).toBe(false);
      expect(saved.variants ?? []).toEqual([]);
    });

    it("should block a variant equal to the term and duplicate variants (C16)", async () => {
      renderSheet(makeGlossary());
      const input = screen.getByLabelText("Variants");
      addChip(input, "workspace ");
      save();
      expect(await screen.findByText("Variant can't be the same as the term")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Remove variant workspace" }));
      addChip(input, "Area");
      addChip(input, "area");
      save();
      expect(await screen.findByText("Variant already listed")).toBeTruthy();
      expect(saveGlossaryAsync).not.toHaveBeenCalled();
    });

    it("should block more than 20 variants and variants over 200 characters", async () => {
      renderSheet(makeGlossary());
      const input = screen.getByLabelText("Variants");
      addChip(input, "x".repeat(201));
      save();
      expect(await screen.findByText("Variant must be 200 characters or fewer")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: `Remove variant ${"x".repeat(201)}` }));
      fireEvent.change(input, {
        target: { value: `${Array.from({ length: 21 }, (_, i) => `v${i}`).join(",")},` },
      });
      save();
      expect(await screen.findByText("Add at most 20 variants")).toBeTruthy();
      expect(saveGlossaryAsync).not.toHaveBeenCalled();
    });

    it("should start a corrupt term with Case-sensitive off and no variants", () => {
      renderSheet(makeGlossary({ additionalNote: `${PREFIX}{broken` }));
      expect(
        screen.getByRole("switch", { name: "Case-sensitive" }).getAttribute("aria-checked"),
      ).toBe("false");
      expect(screen.queryByRole("button", { name: /^Remove variant / })).toBeNull();
    });

    it("should disable both fields for an unsupported version", () => {
      renderSheet(makeGlossary({ additionalNote: "@@glossary-meta:v2@@{}" }));
      expect(
        (screen.getByRole("switch", { name: "Case-sensitive" }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect((screen.getByLabelText("Variants") as HTMLInputElement).disabled).toBe(true);
    });
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

  it("should not limit the size of the terminology data, which is no longer serialized", async () => {
    renderSheet(
      makeGlossary({
        translations: [{ language: "it-IT", value: "x".repeat(20000), forbiddenValues: [] }],
      }),
    );
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(screen.queryByText("Too much terminology data for one term")).toBeNull();
  });

  it("should save translation values as typed, without a marker in the context (C8)", async () => {
    renderSheet(makeGlossary());
    fireEvent.change(screen.getByLabelText("German (de-DE)"), {
      target: { value: 'A;B→"C"' },
    });
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload().context).toBe("");
    expect(lastPayload().translations).toEqual([
      { language: "de-DE", value: 'A;B→"C"', forbiddenValues: [] },
    ]);
  });

  it("should load the definition without the marker and save it without one (C9)", async () => {
    renderSheet(
      makeGlossary({
        context: "A container. ⟦rule: de-DE→Alt⟧",
        translations: [{ language: "de-DE", value: "Neu", forbiddenValues: [] }],
      }),
    );
    expect((screen.getByPlaceholderText("What the term means") as HTMLTextAreaElement).value).toBe(
      "A container.",
    );
    save();
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload().context).toBe("A container.");
    expect(lastPayload().context).not.toContain("⟦rule:");
    expect(lastPayload().additionalNote).not.toContain("@@glossary-meta");
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

  describe("picker-mode props", () => {
    it.each([
      [true, 0],
      [false, 1],
    ])(
      "with isolateEvents=%s, a click and a key press in the sheet bubble out %i time(s)",
      (isolateEvents, times) => {
        const onClick = vi.fn();
        const onKeyDown = vi.fn();
        document.addEventListener("click", onClick);
        document.addEventListener("keydown", onKeyDown);
        try {
          render(<GlossaryEditorSheet open onOpenChange={vi.fn()} isolateEvents={isolateEvents} />);
          fireEvent.click(nameInput());
          fireEvent.keyDown(nameInput(), { key: "a" });
          expect(onClick).toHaveBeenCalledTimes(times);
          expect(onKeyDown).toHaveBeenCalledTimes(times);
        } finally {
          document.removeEventListener("click", onClick);
          document.removeEventListener("keydown", onKeyDown);
        }
      },
    );

    it("should pre-fill the name from initialName and call onSaved with the trimmed name", async () => {
      const onOpenChange = vi.fn();
      const onSaved = vi.fn();
      render(
        <GlossaryEditorSheet
          open
          onOpenChange={onOpenChange}
          initialName="  Onboardng "
          onSaved={onSaved}
        />,
      );
      expect((nameInput() as HTMLInputElement).value).toBe("  Onboardng ");
      save();
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Onboardng"));
      expect(lastPayload()).toEqual(expect.objectContaining({ name: "Onboardng" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should ignore initialName when editing an existing glossary", () => {
      render(
        <GlossaryEditorSheet
          open
          onOpenChange={vi.fn()}
          glossary={makeGlossary({ name: "Stored" })}
          initialName="Other"
        />,
      );
      expect((nameInput() as HTMLInputElement).value).toBe("Stored");
    });

    it("should not call onSaved when the server rejects the save (C8)", async () => {
      saveGlossaryAsync.mockResolvedValue({ success: false, errorMessage: "Forbidden" });
      const onSaved = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <GlossaryEditorSheet
          open
          onOpenChange={onOpenChange}
          initialName="Gadget"
          onSaved={onSaved}
        />,
      );
      save();
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
      expect(onSaved).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("should start empty without initialName (H16)", () => {
      renderSheet();
      expect((nameInput() as HTMLInputElement).value).toBe("");
    });
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

    it("should offer 'Select it' in picker mode: selects the existing term and closes (H15)", async () => {
      const onOpenChange = vi.fn();
      const onSelectExisting = vi.fn();
      render(
        <GlossaryEditorSheet
          open
          onOpenChange={onOpenChange}
          initialName="workspace"
          onSelectExisting={onSelectExisting}
        />,
      );
      await waitForDebounce();
      expect(screen.getByText(/'Workspace' already exists/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Open it" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Select it" }));
      expect(onSelectExisting).toHaveBeenCalledWith(existingGlossaries[0]);
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(navigate).not.toHaveBeenCalled();
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

  describe("version conflict (SPEC5)", () => {
    const CONFLICT_TEXT =
      "This term was changed by someone else. Reload the latest version and re-apply your changes.";
    const versionError = {
      propertyName: "Version",
      errorMessage: "This glossary was changed by someone else. Reload and try again.",
    };
    const reloadButton = () => screen.getByRole("button", { name: "Reload latest" });

    const renderConflict = async (
      glossary = makeGlossary({ version: 4 }),
      onOpenChange = vi.fn(),
    ) => {
      saveGlossaryAsync.mockResolvedValueOnce({ success: false, validationErrors: [versionError] });
      renderSheet(glossary, onOpenChange);
      typeName("Workspace edited");
      save();
      await screen.findByText(CONFLICT_TEXT);
      return onOpenChange;
    };

    it("should send the version the sheet was opened with on edit", async () => {
      renderSheet(makeGlossary({ version: 4 }));
      save();
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
      expect(lastPayload().version).toBe(4);
    });

    it("should send version 0 for a legacy term", async () => {
      renderSheet(makeGlossary({ version: 0 }));
      save();
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
      expect(lastPayload().version).toBe(0);
    });

    it("should not send a version on create", async () => {
      renderSheet();
      typeName("Brand new");
      save();
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
      expect(lastPayload()).not.toHaveProperty("version");
    });

    it("should show the Alert instead of a toast and keep the user's input", async () => {
      const onOpenChange = await renderConflict();
      expect(screen.getByRole("alert").textContent).toContain(CONFLICT_TEXT);
      expect(showErrorToast).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect((nameInput() as HTMLInputElement).value).toBe("Workspace edited");
    });

    it("should show the Alert for the Version error and a toast for each other error (C16)", async () => {
      saveGlossaryAsync.mockResolvedValueOnce({
        success: false,
        validationErrors: [
          versionError,
          { propertyName: "Name", errorMessage: "Glossary name must be unique." },
        ],
      });
      renderSheet(makeGlossary({ version: 4 }));
      typeName("Workspace edited");
      save();
      expect(await screen.findByText(CONFLICT_TEXT)).toBeTruthy();
      expect(showErrorToast).toHaveBeenCalledTimes(1);
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "Glossary name must be unique." });
      expect((nameInput() as HTMLInputElement).value).toBe("Workspace edited");
    });

    it("should remount the form with the fresh term, re-reading its stored fields (H11, C5)", async () => {
      await renderConflict(makeGlossary({ version: 4, additionalNote: "plain old note" }));
      fetchLatestGlossary.mockResolvedValue(
        makeGlossary({
          name: "Workspace v5",
          version: 5,
          moduleIds: ["m1"],
          isGlobal: false,
          caseSensitive: true,
          variants: ["workspaces"],
          status: "draft",
        }),
      );

      fireEvent.click(reloadButton());

      await waitFor(() => expect(screen.queryByText(CONFLICT_TEXT)).toBeNull());
      expect(fetchLatestGlossary).toHaveBeenCalledWith("g1");
      expect((nameInput() as HTMLInputElement).value).toBe("Workspace v5");
      expect(screen.getByText("workspaces")).toBeTruthy();
      expect(
        screen.getByRole("switch", { name: /Case-sensitive/ }).getAttribute("aria-checked"),
      ).toBe("true");
      expect(screen.queryByLabelText("Additional note")).toBeNull();

      save();
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalledTimes(2));
      expect(lastPayload()).toMatchObject({
        name: "Workspace v5",
        version: 5,
        moduleIds: ["m1"],
        caseSensitive: true,
        variants: ["workspaces"],
        status: "draft",
      });
    });

    it("should show a spinner and disable Reload latest while refetching", async () => {
      await renderConflict();
      fetchLatestGlossary.mockReturnValue(new Promise(() => {}));
      fireEvent.click(reloadButton());
      await waitFor(() => expect((reloadButton() as HTMLButtonElement).disabled).toBe(true));
      expect(reloadButton().querySelector(".animate-spin")).toBeTruthy();
      fireEvent.click(reloadButton());
      expect(fetchLatestGlossary).toHaveBeenCalledTimes(1);
    });

    it("should keep the form and the Alert and toast when the refetch fails", async () => {
      const onOpenChange = await renderConflict();
      fetchLatestGlossary.mockRejectedValue(new Error("network"));
      fireEvent.click(reloadButton());
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
      );
      expect(screen.getByText(CONFLICT_TEXT)).toBeTruthy();
      expect((nameInput() as HTMLInputElement).value).toBe("Workspace edited");
      expect((reloadButton() as HTMLButtonElement).disabled).toBe(false);
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("should close with a toast when the term was deleted meanwhile", async () => {
      const onOpenChange = await renderConflict();
      fetchLatestGlossary.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
      fireEvent.click(reloadButton());
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "This term no longer exists." });
    });

    it("should toast an ItemId error and keep the sheet open", async () => {
      saveGlossaryAsync.mockResolvedValueOnce({
        success: false,
        validationErrors: [{ propertyName: "ItemId", errorMessage: "Glossary item not found" }],
      });
      const onOpenChange = vi.fn();
      renderSheet(makeGlossary({ version: 4 }), onOpenChange);
      save();
      await waitFor(() =>
        expect(showErrorToast).toHaveBeenCalledWith({ errors: "Glossary item not found" }),
      );
      expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
