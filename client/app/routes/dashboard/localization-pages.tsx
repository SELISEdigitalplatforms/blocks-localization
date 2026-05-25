import GlossaryTable from "@blocks-localization/components/glossary/glossary-table";
import GlossaryDetails from "@blocks-localization/components/glossary/glossary-details";
import { AddNewLanguageKey } from "@blocks-localization/language-module/add-new-language-key/add-new-language-key";
import { Configure } from "@blocks-localization/language-module/configure/configure";
import { ExportHistory } from "@blocks-localization/language-module/export-history/export-history";
import { KeyDetails } from "@blocks-localization/language-module/key-details/key-details";
import { LanguageLogs } from "@blocks-localization/language-module/activity-log/language-logs";
import { LanguageTable } from "@blocks-localization/language-module/language-table/language-table";
import { ModuleTable } from "@blocks-localization/language-module/modules/module-table/module-table";
import { ModuleDetails } from "@blocks-localization/language-module/modules/module-details/module-details";
import { useParams } from "react-router-dom";

function LocalizationPageLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full w-full min-w-0 p-6">{children}</div>;
}

export function LocalizationLanguageHomePage() {
  return (
    <LocalizationPageLayout>
      <LanguageTable />
    </LocalizationPageLayout>
  );
}

export function LocalizationNewKeyPage() {
  return (
    <LocalizationPageLayout>
      <AddNewLanguageKey />
    </LocalizationPageLayout>
  );
}

export function LocalizationKeyDetailPage() {
  return (
    <LocalizationPageLayout>
      <KeyDetails />
    </LocalizationPageLayout>
  );
}

export function LocalizationConfigurePage() {
  return (
    <LocalizationPageLayout>
      <Configure />
    </LocalizationPageLayout>
  );
}

export function LocalizationModulesPage() {
  return (
    <LocalizationPageLayout>
      <ModuleTable />
    </LocalizationPageLayout>
  );
}

export function LocalizationModuleDetailPage() {
  return (
    <LocalizationPageLayout>
      <ModuleDetails />
    </LocalizationPageLayout>
  );
}

export function LocalizationExportHistoryPage() {
  return (
    <LocalizationPageLayout>
      <ExportHistory />
    </LocalizationPageLayout>
  );
}

export function LocalizationLogsPage() {
  return (
    <LocalizationPageLayout>
      <LanguageLogs />
    </LocalizationPageLayout>
  );
}

export function LocalizationGlossaryPage() {
  return (
    <LocalizationPageLayout>
      <GlossaryTable />
    </LocalizationPageLayout>
  );
}

export function LocalizationGlossaryDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  return (
    <LocalizationPageLayout>
      <GlossaryDetails itemId={itemId ?? ""} />
    </LocalizationPageLayout>
  );
}
