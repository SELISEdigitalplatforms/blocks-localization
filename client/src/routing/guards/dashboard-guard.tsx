import { useConsoleProjects } from "@/features/console/hooks/use-console-projects";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { env } from "@/config/env";
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export function DashboardGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const selectedProject = useConsoleProjectStore((s) => s.selectedProject);
  const tenantGroup = useConsoleProjectStore((s) => s.selectedTenantGroup) ?? "";
  const { data, isSuccess } = useConsoleProjects(tenantGroup);

  useEffect(() => {
    if (!selectedProject) {
      navigate("/console", { replace: true });
    }
  }, [navigate, selectedProject]);

  useEffect(() => {
    if (!tenantGroup || !env.apiBaseUrl) return;
    if (isSuccess && (!data || data.length === 0)) {
      navigate("/console", { replace: true });
    }
  }, [data, isSuccess, navigate, tenantGroup]);

  if (!selectedProject) return null;
  if (tenantGroup && isSuccess && (!data || data.length === 0)) return null;
  return children;
}
