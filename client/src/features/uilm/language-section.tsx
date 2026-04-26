import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { useUilmProjectStore } from "@/features/uilm/state/uilm-project-store";
import { PageMeta } from "@/seo/page-meta";
import { useEffect } from "react";
import { Outlet } from "react-router-dom";

/**
 * Localization routes inside `DashboardShellLayout`.
 * Project context matches the monolith: tenant comes from the console project selection (see
 * `ConsoleProjectListDropdown`) or `NEXT_PUBLIC_UILM_PROJECT_KEY` / **Configure** — no extra key bar here.
 */
export function LanguageSection() {
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
    <div className="min-w-0 w-full space-y-3 px-3 pt-2 pb-4 md:px-4 md:pb-5">
      <PageMeta title="Language" />
      <Outlet />
    </div>
  );
}
