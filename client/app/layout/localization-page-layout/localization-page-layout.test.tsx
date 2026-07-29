import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import * as pages from "./localization-page-layout";

// Stub the heavy page components so we only exercise the layout wrappers.
vi.mock("@blocks-localization/components/glossary/glossary-table", () => ({
  default: () => <div>GlossaryTable</div>,
}));
vi.mock("@blocks-localization/components/glossary/glossary-details", () => ({
  default: ({ itemId }: { itemId: string }) => <div>GlossaryDetails:{itemId}</div>,
}));
vi.mock("@blocks-localization/language-module/add-new-language-key/add-new-language-key", () => ({
  AddNewLanguageKey: () => <div>AddNewLanguageKey</div>,
}));
vi.mock("@blocks-localization/language-module/configure/configure", () => ({
  Configure: () => <div>Configure</div>,
}));
vi.mock("@blocks-localization/language-module/export-history/export-history", () => ({
  ExportHistory: () => <div>ExportHistory</div>,
}));
vi.mock("@blocks-localization/language-module/key-details/key-details", () => ({
  KeyDetails: () => <div>KeyDetails</div>,
}));
vi.mock("@blocks-localization/language-module/activity-log/language-logs", () => ({
  LanguageLogs: () => <div>LanguageLogs</div>,
}));
vi.mock("@blocks-localization/language-module/language-table/language-table", () => ({
  LanguageTable: () => <div>LanguageTable</div>,
}));
vi.mock("@blocks-localization/language-module/modules/module-table/module-table", () => ({
  ModuleTable: () => <div>ModuleTable</div>,
}));
vi.mock("@blocks-localization/language-module/modules/module-details/module-details", () => ({
  ModuleDetails: () => <div>ModuleDetails</div>,
}));

describe("layout/localization-page-layout", () => {
  it.each([
    ["LocalizationLanguageHomePage", "LanguageTable"],
    ["LocalizationNewKeyPage", "AddNewLanguageKey"],
    ["LocalizationKeyDetailPage", "KeyDetails"],
    ["LocalizationConfigurePage", "Configure"],
    ["LocalizationModulesPage", "ModuleTable"],
    ["LocalizationModuleDetailPage", "ModuleDetails"],
    ["LocalizationExportHistoryPage", "ExportHistory"],
    ["LocalizationLogsPage", "LanguageLogs"],
    ["LocalizationGlossaryPage", "GlossaryTable"],
  ])("%s should render its page content", (pageName, expected) => {
    const Page = (pages as Record<string, React.FC>)[pageName];
    render(<Page />);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it("LocalizationGlossaryDetailPage should pass the glossaryId from the route", () => {
    render(
      <MemoryRouter initialEntries={["/glossary/g1"]}>
        <Routes>
          <Route path="/glossary/:glossaryId" element={<pages.LocalizationGlossaryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("GlossaryDetails:g1")).toBeTruthy();
  });
});
