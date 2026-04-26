import { DataMigrationView } from "@/features/console/data-migration/data-migration-view";
import { PageMeta } from "@/seo/page-meta";

export function DataMigrationPage() {
  return (
    <div className="thin-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-surface-app">
      <PageMeta title="Environment migration" />
      <DataMigrationView />
    </div>
  );
}
