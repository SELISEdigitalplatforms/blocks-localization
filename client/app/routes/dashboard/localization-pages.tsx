import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import GlossaryTable from "@blocks-localization/components/glossary/glossary-table";
import { AddNewLanguageKey } from "@blocks-localization/language-module/add-new-language-key/add-new-language-key";
import { Configure } from "@blocks-localization/language-module/configure/configure";
import { ExportHistory } from "@blocks-localization/language-module/export-history/export-history";
import { KeyDetails } from "@blocks-localization/language-module/key-details/key-details";
import { LanguageLogs } from "@blocks-localization/language-module/logs/language-logs";
import { LanguageTable } from "@blocks-localization/language-module/language-table/language-table";

export function LocalizationLanguageHomePage() {
  return (
    <div className="h-full w-full min-w-0 p-6">
      <LanguageTable />
    </div>
  );
}

export function LocalizationNewKeyPage() {
  return <div className="h-full w-full min-w-0 p-6"><AddNewLanguageKey /></div>;
}

export function LocalizationKeyDetailPage() {
  return <div className="h-full w-full min-w-0 p-6"><KeyDetails /></div>;
}

export function LocalizationConfigurePage() {
  return <div className="h-full w-full min-w-0 p-6"><Configure /></div>;
}

export function LocalizationExportHistoryPage() {
  return <div className="h-full w-full min-w-0 p-6"><ExportHistory /></div>;
}

export function LocalizationLogsPage() {
  return <div className="h-full w-full min-w-0 p-6"><LanguageLogs /></div>;
}

export function LocalizationGlossaryPage() {
  return (
    <div className="h-full w-full min-w-0 p-6">
      <main className="flex flex-col">
        <div className="hidden md:flex">
          <PageBreadcrumb breadcrumbIndex={2} />
        </div>
        <GlossaryTable />
      </main>
    </div>
  );
}
