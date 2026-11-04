import { fireEvent, screen } from "@testing-library/react";
import { tStatic, useI18nStore } from "@seliseblocks/genesis-os/i18n";
import { useAppSettingsStore } from "@seliseblocks/genesis-os/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import glossaryEn from "@/i18n/localization.glossary.en.json";
import { renderWithProviders } from "@/test-utils/render";
import { TooltipProvider } from "@/components/ui-kits/tooltip/tooltip";
import { IGlossary } from "@blocks-localization/models/language";
import { useGlossaryBulk } from "@blocks-localization/hooks/use-glossary-bulk";
import { useGetLanguageModules } from "@blocks-localization/hooks/use-language-manager";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import GlossaryBulkActions from "./glossary-bulk-actions";
import GlossaryMobileList from "./glossary-mobile-list";
import GlossaryTermChip from "./glossary-term-chip";
import { getGlossaryTermMenuHint } from "./glossary-term-menu";

vi.mock("@seliseblocks/genesis-os", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), showErrorToast: vi.fn() }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetAllModuleGlossaries: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
  useGetLanguageModules: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-glossary-bulk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@blocks-localization/hooks/use-glossary-bulk")>()),
  useGlossaryBulk: vi.fn(),
}));
vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: { getGlossaryUsage: vi.fn() },
}));

const de = (text: string) => `DE ${text}`;

const germanGlossary = Object.fromEntries(
  Object.entries(glossaryEn).map(([key, value]) => [key, de(value)]),
);
const germanCommon = { EDIT: "Bearbeiten", DELETE: "Löschen", CANCEL: "Abbrechen", RETRY: "Erneut" };

const glossary: IGlossary = {
  itemId: "g1",
  name: "Workspace",
  createDate: "",
  lastUpdateDate: "",
  rule: "translate",
  status: "approved",
  isGlobal: false,
  moduleIds: ["m1", "m2"],
  translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: [] }],
};

/** English text CL10 moved to `useT`; none may be left in the German UI. */
const ENGLISH = [
  "Whole project",
  "2 modules",
  "Actions for Workspace",
  "Glossaries",
  "Bulk actions",
  "Clear selection",
  "2 selected",
  "Approve",
  "Deprecate",
  "Tag to module",
  "Set whole project",
  "Tag Workspace to key",
  "Remove Workspace from key",
  "Tagged",
  "Delete 2 glossaries",
];

const visibleStrings = (root: HTMLElement) => [
  ...[...root.querySelectorAll("*")].flatMap((element) =>
    ["aria-label", "title", "placeholder"].flatMap((name) => element.getAttribute(name) ?? []),
  ),
  ...[...root.querySelectorAll("*")].flatMap((element) =>
    [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean),
  ),
];

describe("glossary UI in German (SPEC15 H28, C32)", () => {
  beforeEach(() => {
    useI18nStore.getState().setRemote("de", "localization.glossary", germanGlossary);
    useI18nStore.getState().setRemote("de", "common", germanCommon);
    useAppSettingsStore.getState().setSettings({ language: "de" });
    vi.mocked(useGlossaryBulk).mockReturnValue({ run: vi.fn(), progress: null, isRunning: false });
    vi.mocked(useGetLanguageModules).mockReturnValue({ data: [] } as never);
    vi.mocked(languageManagerService.getGlossaryUsage).mockResolvedValue({
      keyCount: 1,
      keys: [],
      moduleIds: [],
    } as never);
  });

  afterEach(() => {
    useAppSettingsStore.getState().setSettings({ language: "en" });
  });

  it("renders the mobile list, bulk bar, bulk delete dialog and chips from useT keys", async () => {
    const { container } = renderWithProviders(
      <TooltipProvider>
        <GlossaryMobileList
          glossaries={[glossary]}
          languages={[]}
          isLoading={false}
          emptyState={null}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
        <GlossaryBulkActions
          selected={[glossary, { ...glossary, itemId: "g2", name: "Invoice" }]}
          onClearSelection={vi.fn()}
          onReload={vi.fn()}
        />
        <GlossaryTermChip glossary={glossary} source="tagged" onRemove={vi.fn()} />
        <GlossaryTermChip glossary={glossary} source="suggested" onAdd={vi.fn()} />
      </TooltipProvider>,
    );

    expect(screen.getByRole("list", { name: de("Glossaries") })).toBeTruthy();
    expect(screen.getByText(de("2 modules"))).toBeTruthy();
    expect(screen.getByRole("toolbar", { name: de("Bulk actions") })).toBeTruthy();
    expect(screen.getByText(de("2 selected"))).toBeTruthy();
    expect(screen.getByRole("button", { name: de("Remove Workspace from key") })).toBeTruthy();
    expect(screen.getByRole("button", { name: de("Tag Workspace to key") })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: de("Delete") }));
    expect(await screen.findByText(de("Used by up to 2 keys in total."))).toBeTruthy();
    expect(screen.getByText(de("Delete 2 glossaries"))).toBeTruthy();

    const strings = [...visibleStrings(container), ...visibleStrings(document.body)];
    for (const english of ENGLISH) expect(strings).not.toContain(english);
  });

  it("translates the insert-menu shortcut hint", () => {
    const t = (key: string, values?: Record<string, string | number>) =>
      tStatic("localization.glossary", key, values);
    expect(getGlossaryTermMenuHint(t)).toMatch(/^DE Press .+ to insert a glossary at the cursor\.$/);
  });
});
