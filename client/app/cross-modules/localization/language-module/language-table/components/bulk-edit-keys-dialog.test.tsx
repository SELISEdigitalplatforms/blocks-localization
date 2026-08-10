import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import type { IBlocksLanguageKey, ILanguageConfig } from "@blocks-localization/models/language";
import { buildBulkEditPayload, BulkEditKeysDialog } from "./bulk-edit-keys-dialog";

const saveKeysAsync = vi.fn();

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetGlossaries: vi.fn(),
  useGetModuleGlossaries: vi.fn(),
  useSearchGlossaries: vi.fn(),
  useSaveBlocksLanguageKeys: vi.fn(),
}));

const languages: ILanguageConfig[] = [
  { itemId: "en", languageName: "English", languageCode: "en-US", isDefault: true },
  { itemId: "de", languageName: "German", languageCode: "de-DE" },
];

const keys: IBlocksLanguageKey[] = [
  {
    itemId: "key-1",
    keyName: "about",
    moduleId: "module-1",
    routes: ["/about"],
    glossaryIds: ["glossary-1"],
    resources: [
      { culture: "en-US", value: "About" },
      { culture: "fr-FR", value: "À propos" },
    ],
    isPartiallyTranslated: false,
    createDate: "2026-01-01",
    lastUpdateDate: "2026-01-02",
    context: "Navigation",
  },
  {
    itemId: "key-2",
    keyName: "home_page",
    moduleId: "module-2",
    routes: [],
    glossaryIds: [],
    resources: [{ culture: "en-US", value: "Home page" }],
    isPartiallyTranslated: true,
    createDate: "2026-01-01",
    lastUpdateDate: "2026-01-02",
    context: "Heading",
  },
];

const renderDialog = (onSaved = vi.fn(), onCancel = vi.fn()) =>
  render(
    <Dialog open onOpenChange={() => {}}>
      <BulkEditKeysDialog keys={keys} languages={languages} onCancel={onCancel} onSaved={onSaved} />
    </Dialog>,
  );

describe("BulkEditKeysDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useGetGlossaries).mockReturnValue({
      data: {
        items: [
          { itemId: "glossary-1", name: "Navigation terms" },
          { itemId: "glossary-2", name: "Product terms", type: "Phrase" },
        ],
      },
      isLoading: false,
    } as never);
    vi.mocked(hooks.useSearchGlossaries).mockReturnValue({
      data: {
        items: [{ itemId: "glossary-2", name: "Product terms", type: "Phrase" }],
      },
    } as never);
    vi.mocked(hooks.useGetModuleGlossaries).mockImplementation(
      (moduleId) =>
        ({
          data: {
            items:
              moduleId === "module-1"
                ? [{ itemId: "module-glossary", name: "Module terminology" }]
                : [],
          },
          isLoading: false,
        }) as never,
    );
    vi.mocked(hooks.useSaveBlocksLanguageKeys).mockReturnValue({
      isPending: false,
      mutateAsync: saveKeysAsync,
    } as never);
  });

  it("builds full key payloads while preserving modules and unconfigured resources", () => {
    const payload = buildBulkEditPayload(keys, languages, "Green light", ["glossary-2"]);

    expect(payload[0]).toMatchObject({
      itemId: "key-1",
      moduleId: "module-1",
      routes: ["/about"],
      glossaryIds: ["glossary-1", "glossary-2"],
      context: "Navigation",
    });
    expect(payload[0].resources).toEqual(
      expect.arrayContaining([
        { culture: "en-US", value: "Green light" },
        { culture: "de-DE", value: "Green light" },
        { culture: "fr-FR", value: "À propos" },
      ]),
    );
    expect(payload[1]).toMatchObject({
      itemId: "key-2",
      moduleId: "module-2",
      glossaryIds: ["glossary-2"],
    });
  });

  it("does not create a direct assignment when the glossary is inherited from the module", () => {
    const payload = buildBulkEditPayload(keys, languages, "Green light", ["module-glossary"], {
      "module-1": ["module-glossary"],
    });

    expect(payload[0].glossaryIds).toEqual(["glossary-1"]);
    expect(payload[1].glossaryIds).toEqual(["module-glossary"]);
  });

  it("omits keys that have no translation or glossary changes", () => {
    const payload = buildBulkEditPayload(keys, languages, "", ["glossary-1"], {
      "module-2": ["glossary-1"],
    });

    expect(payload).toEqual([]);
  });

  it("shows each selected key and its current glossary assignment", () => {
    renderDialog();

    expect(screen.getByRole("dialog").className).toContain("grid-rows-[auto_minmax(0,1fr)_auto]");
    expect(screen.getByText("about")).toBeTruthy();
    expect(screen.getByText("home_page")).toBeTruthy();
    expect(screen.getByText("Navigation terms")).toBeTruthy();
    expect(screen.getByText("Module terminology")).toBeTruthy();
    expect(screen.getByText("No glossary assigned")).toBeTruthy();
  });

  it("applies a selected glossary and shared value to every key", async () => {
    const onSaved = vi.fn();
    saveKeysAsync.mockResolvedValue({ success: true });
    renderDialog(onSaved);

    fireEvent.change(
      screen.getByRole("textbox", { name: "Translation value for all selected keys" }),
      {
        target: { value: "Green light" },
      },
    );
    fireEvent.click(screen.getByRole("combobox", { name: /Search and add glossaries/i }));
    fireEvent.click(screen.getByRole("option", { name: /Product terms/i }));

    expect(saveKeysAsync).not.toHaveBeenCalled();
    expect(screen.getAllByTitle("Will be assigned when saved")).toHaveLength(2);

    const saveButton = screen.getByRole("button", { name: "Save 2 keys" });
    await waitFor(() => expect((saveButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(saveButton);

    await waitFor(() => expect(saveKeysAsync).toHaveBeenCalledTimes(1));
    const payload = saveKeysAsync.mock.calls[0][0];
    expect(payload).toHaveLength(2);
    expect(
      payload.every((key: { glossaryIds: string[] }) => key.glossaryIds.includes("glossary-2")),
    ).toBe(true);
    expect(
      payload.every(
        (key: { glossaryIds: string[] }) => !key.glossaryIds.includes("module-glossary"),
      ),
    ).toBe(true);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Bulk edit complete" }));
  });

  it("saves glossary-only changes without overwriting translations", async () => {
    saveKeysAsync.mockResolvedValue({ success: true });
    renderDialog();

    fireEvent.click(screen.getByRole("combobox", { name: /Search and add glossaries/i }));
    fireEvent.click(screen.getByRole("option", { name: /Product terms/i }));

    expect(screen.queryByText(/Saving will overwrite/i)).toBeNull();
    const saveButton = await screen.findByRole("button", { name: "Save 2 keys" });
    await waitFor(() => expect((saveButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(saveButton);

    await waitFor(() => expect(saveKeysAsync).toHaveBeenCalledTimes(1));
    const payload = saveKeysAsync.mock.calls[0][0];
    expect(payload[0].resources).toEqual(keys[0].resources);
    expect(payload[1].resources).toEqual(keys[1].resources);
  });

  it("keeps the dialog open when the endpoint reports a bulk error", async () => {
    const onSaved = vi.fn();
    saveKeysAsync.mockResolvedValue({ success: false, errorMessage: "One key could not be saved" });
    renderDialog(onSaved);

    fireEvent.change(
      screen.getByRole("textbox", { name: "Translation value for all selected keys" }),
      {
        target: { value: "Green light" },
      },
    );
    const saveButton = screen.getByRole("button", { name: "Save 2 keys" });
    await waitFor(() => expect((saveButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(saveButton);

    await waitFor(() => expect(saveKeysAsync).toHaveBeenCalledTimes(1));
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Bulk edit failed",
        description: "One key could not be saved",
      }),
    );
  });
});
