import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { useUilmProjectStore } from "@/features/uilm/state/uilm-project-store";
import { ProtectedRoute } from "@/routing/guards/protected-route";
import { PageMeta } from "@/seo/page-meta";
import { useEffect } from "react";
import { Outlet } from "react-router-dom";

/**
 * Standalone localization shell with `Outlet` (for a parent route that mounts `languageRouteChildren`).
 * Primary product path is `LanguageSection` inside `DashboardShellLayout`.
 */
export function LanguageShell() {
  const selectedProject = useConsoleProjectStore((s) => s.selectedProject);
  const projectKey = useUilmProjectStore((s) => s.projectKey);
  const setUilmProjectKey = useUilmProjectStore((s) => s.setProjectKey);

  useEffect(() => {
    const tenantId = selectedProject?.tenantId?.trim();
    if (tenantId && !projectKey.trim()) {
      setUilmProjectKey(tenantId);
    }
  }, [selectedProject?.tenantId, projectKey, setUilmProjectKey]);

  return (
    <ProtectedRoute>
      <div className="thin-scrollbar flex h-full min-h-0 flex-col overflow-y-auto overscroll-y-contain bg-surface-app">
        <PageMeta title="Language" />
        <div className="min-w-0 w-full space-y-3 px-3 pt-2 pb-4 md:px-4 md:pb-5">
          <Outlet />
        </div>
      </div>
    </ProtectedRoute>
  );
}
