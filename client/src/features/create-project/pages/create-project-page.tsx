import { CreateProjectViewRoot } from "@/features/create-project/create-project-view";
import { ProtectedRoute } from "@/routing/guards/protected-route";
import { PageMeta } from "@/seo/page-meta";

export function CreateProjectPage() {
  return (
    <ProtectedRoute>
      <div className="thin-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        <PageMeta title="Create project" />
        <CreateProjectViewRoot />
      </div>
    </ProtectedRoute>
  );
}
