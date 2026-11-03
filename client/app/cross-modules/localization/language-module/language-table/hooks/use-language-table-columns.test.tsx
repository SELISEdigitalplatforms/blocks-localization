import type { ReactNode } from "react";
import { render, renderHook, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  getCompletenessCellValue,
  getModuleBadgeStyle,
  getReadableTextColor,
  hasNonEmptyValue,
  isKeyComplete,
  useLanguageTableColumns,
} from "./use-language-table-columns";
import type { IBlocksLanguageKey, ILanguageConfig } from "@blocks-localization/models/language";

const enUS: ILanguageConfig = { languageCode: "en-US", languageName: "English" };
const deDE: ILanguageConfig = { languageCode: "de-DE", languageName: "German" };

const makeResource = (culture: string, value: string): IBlocksLanguageKey["resources"][number] => ({
  culture,
  value,
});

// H1
it("returns Complete when every active language has a non-empty resource", () => {
  const resources: IBlocksLanguageKey["resources"] = [
    makeResource("en-US", "Save"),
    makeResource("de-DE", "Speichern"),
  ];
  expect(getCompletenessCellValue(resources, [enUS, deDE])).toBe("Complete");
});

// H2
it("returns Partial when some active languages have non-empty resources", () => {
  const resources: IBlocksLanguageKey["resources"] = [makeResource("en-US", "Save")];
  expect(getCompletenessCellValue(resources, [enUS, deDE])).toBe("Partial");
});

// H3
it("returns No translation when resources is empty", () => {
  expect(getCompletenessCellValue([], [enUS])).toBe("No translation");
  expect(getCompletenessCellValue([], [])).toBe("No translation");
});

// C1 — BUG FIX: all-empty-string key was "Complete", should be "No translation"
it("returns No translation when all resources are empty strings", () => {
  const resources: IBlocksLanguageKey["resources"] = [
    makeResource("en-US", ""),
    makeResource("de-DE", ""),
  ];
  expect(getCompletenessCellValue(resources, [enUS, deDE])).toBe("No translation");
});

// C2 — BUG FIX: retired-language-only key was "Partial", should be "No translation"
it("returns No translation when all resources belong to retired languages", () => {
  const resources: IBlocksLanguageKey["resources"] = [makeResource("de-DE", "Hallo")];
  expect(getCompletenessCellValue(resources, [enUS])).toBe("No translation");
});

// C3 — BUG FIX: retired-language key with empty value
it("returns No translation for retired-language resource with empty value", () => {
  const resources: IBlocksLanguageKey["resources"] = [makeResource("de-DE", "")];
  expect(getCompletenessCellValue(resources, [enUS])).toBe("No translation");
});

// C4 — hasNonEmptyValue must remain correct for per-cell use
it("hasNonEmptyValue returns false for empty string", () => {
  expect(hasNonEmptyValue(makeResource("en-US", ""))).toBe(false);
});

it("hasNonEmptyValue returns true for non-empty string", () => {
  expect(hasNonEmptyValue(makeResource("en-US", "Save"))).toBe(true);
});

it("hasNonEmptyValue returns false for undefined", () => {
  expect(hasNonEmptyValue(undefined)).toBe(false);
});

// H5
it("treats empty-string resource as missing within active-language completeness check", () => {
  const resources: IBlocksLanguageKey["resources"] = [
    makeResource("en-US", "Save"),
    makeResource("de-DE", ""),
  ];
  // en-US is non-empty, de-DE is empty (treated as missing) → Partial
  expect(getCompletenessCellValue(resources, [enUS, deDE])).toBe("Partial");
});

// H6
it("returns No translation when languageListData is empty or undefined", () => {
  expect(getCompletenessCellValue([makeResource("en-US", "Save")], [])).toBe("No translation");
  expect(getCompletenessCellValue([makeResource("en-US", "Save")], undefined)).toBe(
    "No translation",
  );
});

// H6 / C2 combined — all languages retired
it("returns No translation when resources exist only for languages not in languageListData", () => {
  const resources: IBlocksLanguageKey["resources"] = [
    makeResource("de-DE", "Hallo"),
    makeResource("fr-FR", ""),
  ];
  expect(getCompletenessCellValue(resources, [enUS])).toBe("No translation");
});

// Existing correct behaviour — must not regress
it("returns Partial when some but not all active languages are missing", () => {
  const resources: IBlocksLanguageKey["resources"] = [makeResource("en-US", "Save")];
  expect(getCompletenessCellValue(resources, [enUS, deDE])).toBe("Partial");
});

// isKeyComplete unit tests
it("isKeyComplete returns true when all language codes have non-empty resources", () => {
  const resources = [makeResource("en-US", "Save"), makeResource("de-DE", "Hallo")];
  expect(isKeyComplete(resources, ["en-US", "de-DE"])).toBe(true);
});

it("isKeyComplete returns false when at least one language code is missing a non-empty resource", () => {
  const resources = [makeResource("en-US", "Save")];
  expect(isKeyComplete(resources, ["en-US", "de-DE"])).toBe(false);
});

const renderModuleCell = (
  moduleId: string,
  options: Pick<
    Parameters<typeof useLanguageTableColumns>[0],
    "languageModules" | "isLanguageModulesPending"
  >,
) => {
  const { result } = renderHook(() =>
    useLanguageTableColumns({
      expandedRowId: null,
      onSortChange: vi.fn(),
      onToggleExpanded: vi.fn(),
      selectedLanguages: [],
      selectedOptionalColumns: [],
      sortQueryParams: { sortBy: "LastUpdateDate", isDescending: true } as never,
      translatingKeys: new Set(),
      ...options,
    }),
  );
  const moduleColumn = result.current.find(
    (column) => (column as { accessorKey?: string }).accessorKey === "moduleId",
  )!;
  const cell = moduleColumn.cell as (context: unknown) => ReactNode;
  return render(<>{cell({ row: { getValue: () => moduleId } })}</>);
};

it("module cell shows the module name when the module is known", () => {
  renderModuleCell("m1", { languageModules: [{ itemId: "m1", moduleName: "auth" }] });
  expect(screen.getByText("auth")).toBeTruthy();
});

it("module cell shows Loading… while an imported module is still being fetched", () => {
  renderModuleCell("m1", { languageModules: [], isLanguageModulesPending: true });
  expect(screen.getByText("Loading…")).toBeTruthy();
});

it("module cell stays empty when the module is unknown and nothing is pending", () => {
  const { container } = renderModuleCell("m1", { languageModules: [] });
  expect(container.innerHTML).toBe("");
});

const parseHex = (hex: string) =>
  [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
const toLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const luminanceOf = (rgb: number[]) =>
  0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
const parseHsl = (hsl: string) => {
  const [hue] = /hsl\((\d+)/.exec(hsl)!.slice(1).map(Number);
  const chroma = 0.7 * Math.min(0.55, 0.45);
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12;
    return 0.55 - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
};

it("module badge keeps the existing background color format", () => {
  expect(getModuleBadgeStyle("module-1").backgroundColor).toMatch(/^hsl\(\d+, 70%, 55%\)$/);
});

it("module badge text meets WCAG AA contrast for many module ids", () => {
  for (let index = 0; index < 2000; index++) {
    const style = getModuleBadgeStyle(`module-${index}-${index * 7919}`);
    const background = luminanceOf(parseHsl(String(style.backgroundColor)));
    const text = luminanceOf(parseHex(String(style.color)));
    const ratio = (Math.max(background, text) + 0.05) / (Math.min(background, text) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});

it("getReadableTextColor keeps dark text on light backgrounds and white on dark ones", () => {
  expect(getReadableTextColor(0.6)).toBe("#111827");
  expect(getReadableTextColor(0.05)).toBe("#ffffff");
  expect(getReadableTextColor(0.19)).toBe("#000000");
});
