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
import { ChevronDown, Loader } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Parity with Next `src/components/project-list/project-list.tsx` (session projects + switcher).
 */
export function ConsoleProjectListDropdown() {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const { data: projectGroups = [], isLoading } = useConsoleProjects("");
  const selectedProject = useConsoleProjectStore((s) => s.selectedProject);
  const setSelectedProject = useConsoleProjectStore((s) => s.setSelectedProject);
  const setUilmProjectKey = useUilmProjectStore((s) => s.setProjectKey);

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

  const name = selectedProject?.name;
  const projects =
    projectGroups
      .map((g) => g.projects[0])
      .filter((p): p is IProject => Boolean(p)) ?? [];

  const handleProjectSelect = (project: IProject) => {
    const redirectEntry = Object.entries(redirectRegexMap).find(([regex]) =>
      new RegExp(regex).test(pathname),
    );

    if (redirectEntry) {
      const [, targetRoute] = redirectEntry;
      pendingProjectRef.current = project;
      void navigate(targetRoute, { replace: true });
      return;
    }

    setSelectedProject(project);
    setUilmProjectKey(project.tenantId);
    if (pathname.startsWith("/project-overview")) {
      void navigate(pathname, { replace: true });
    } else {
      void navigate("/project-overview/environments", { replace: true });
    }
  };

  return (
     <DropdownMenu>
      <DropdownMenuTrigger className="w-full rounded-sm p-1 hover:bg-accent hover:text-accent-foreground md:p-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col text-left">{name || "Select a Project"}</div>
          <ChevronDown className="ml-auto h-4 w-4" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuLabel>Your Projects</DropdownMenuLabel>
        {isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          projects
            .filter((p) => p.itemId !== selectedProject?.itemId)
            .slice(0, 5)
            .map((project) => (
              <DropdownMenuItem key={project.itemId} onSelect={() => handleProjectSelect(project)}>
                <span className="truncate">{project.name}</span>
              </DropdownMenuItem>
            ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/console")}>View all</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
