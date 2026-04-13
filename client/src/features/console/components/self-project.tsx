import { ConsoleCreateProject } from "@/features/console/components/console-create-project";
import { ConsoleProjectCard } from "@/features/console/components/console-project-card";
import { ProjectCardLoading } from "@/features/console/components/project-card-loading";
import { AddProjectCard } from "@/features/console/components/add-project-card";
import { useConsoleProjects } from "@/features/console/hooks/use-console-projects";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { useUilmProjectStore } from "@/features/uilm/state/uilm-project-store";

function SelfProjectLoading() {
  return (
    <>
      <div className="mt-16 flex items-center justify-between">
        <h4 className="text-xl font-semibold">Blocks projects</h4>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <ProjectCardLoading key={index} />
        ))}
      </div>
    </>
  );
}

export function SelfProject() {
  const { data, isLoading, isFetching, isError, error } = useConsoleProjects();
  const setTennantGroup = useConsoleProjectStore((s) => s.setTennantGroup);
  const setSelectedProject = useConsoleProjectStore((s) => s.setSelectedProject);
  const setUilmProjectKey = useUilmProjectStore((s) => s.setProjectKey);

  if (isLoading || isFetching) return <SelfProjectLoading />;
  if (isError) {
    return (
      <p className="mt-16 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load projects"}
      </p>
    );
  }
  const projectGroups = data ?? [];
  if (!projectGroups.length) return <ConsoleCreateProject />;

  return (
    <>
      <div className="mt-2 flex min-w-0 flex-col justify-between gap-2 sm:gap-3 md:flex-row md:items-center">
        <h4 className="min-w-0 text-xl font-semibold">Your Blocks projects</h4>
        {projectGroups.length > 9 ? (
          <div className="text-medium-emphasis">Please delete an existing project to create a new one.</div>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {projectGroups.length < 10 ? <AddProjectCard /> : null}
        {projectGroups.map((project) => (
          <ConsoleProjectCard
            key={project.tenantGroupId}
            project={project.projects[0]}
            envList={project.projects.map((p) => p.environment)}
            onActivate={() => {
              setTennantGroup(project.tenantGroupId);
              setSelectedProject(project.projects[0]);
              setUilmProjectKey(project.projects[0].tenantId);
            }}
          />
        ))}
      </div>
    </>
  );
}
