import { useDashboardProjectDetail } from "@/features/console/hooks/use-dashboard-project-queries";
import { useConsoleProjects } from "@/features/console/hooks/use-console-projects";
import {
  buildRedirectRegexMap,
  consoleSwitcherRedirectPaths,
} from "@/features/console/lib/console-route-redirects";
import type { IProject } from "@/features/console/model/project";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { useUilmProjectStore } from "@/features/uilm/state/uilm-project-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/platform/ui/components/dropdown-menu/dropdown-menu";
import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Parity with Next `src/components/environment-list/environment-list.tsx` (sibling envs + switcher).
 */
export function ConsoleEnvironmentListDropdown() {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const { data: projectGroups = [], isLoading } = useConsoleProjects("");
  const selectedProject = useConsoleProjectStore((s) => s.selectedProject);
  const setSelectedProject = useConsoleProjectStore((s) => s.setSelectedProject);
  const setUilmProjectKey = useUilmProjectStore((s) => s.setProjectKey);

  const { data: projectDetailResponse } = useDashboardProjectDetail(selectedProject?.itemId ?? "");
  const projectData = projectDetailResponse?.data;

  const pendingProjectRef = useRef<IProject | null>(null);

  const redirectRegexMap = useMemo(
    () => buildRedirectRegexMap(consoleSwitcherRedirectPaths),
    [],
  );

  useEffect(() => {
    if (pendingProjectRef.current) {
      const next = pendingProjectRef.current;
      setSelectedProject(next);
      setUilmProjectKey(next.tenantId);
      pendingProjectRef.current = null;
    }
  }, [pathname, setSelectedProject, setUilmProjectKey]);

  useEffect(() => {
    if (projectData && selectedProject?.itemId === projectData.itemId) {
      setSelectedProject(projectData);
    }
  }, [projectData, selectedProject?.itemId, setSelectedProject]);

  const handleEnvironmentSelect = (project: IProject) => {
    const redirectEntry = Object.entries(redirectRegexMap).find(([regex]) =>
      new RegExp(regex).test(pathname),
    );

    if (redirectEntry) {
      const [, targetRoute] = redirectEntry;
      pendingProjectRef.current = project;
      void navigate(targetRoute, { replace: true });
    } else {
      setSelectedProject(project);
      setUilmProjectKey(project.tenantId);
    }
  };

  const environment = projectData?.environment || selectedProject?.environment;
  const applicationDomain =
    projectData?.applicationDomain || selectedProject?.applicationDomain;

  const siblingProjects = useMemo(() => {
    if (!selectedProject) return [];
    const groupWithSelected = projectGroups.find((group) =>
      group.projects.some((p) => p.itemId === selectedProject.itemId),
    );
    return groupWithSelected?.projects ?? [];
  }, [projectGroups, selectedProject]);

  const otherEnvironments = siblingProjects
    .filter((p) => p.itemId !== selectedProject?.itemId)
    .slice(0, 5);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="w-full rounded-sm p-1 hover:bg-accent hover:text-accent-foreground md:p-2"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden text-left">
            {environment ? (
              <span className="w-fit rounded-sm bg-primary/15 px-2 text-[12px] font-semibold text-foreground dark:bg-primary/25">
                {environment}
              </span>
            ) : (
              <span className="text-muted-foreground">Select an environment</span>
            )}
            <span className="mt-0.5 w-full max-w-[10rem] truncate text-xs text-muted-foreground sm:max-w-[11rem]">
              {applicationDomain || "No domain selected"}
            </span>
          </div>
          <ChevronDown className="ml-auto h-4 w-4 shrink-0" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuLabel>Your Environments</DropdownMenuLabel>
        {isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          otherEnvironments.map((project) => (
            <DropdownMenuItem key={project.itemId} onSelect={() => handleEnvironmentSelect(project)}>
              <span className="truncate">{project.environment}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate("/project-overview/environments")}>
          View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
