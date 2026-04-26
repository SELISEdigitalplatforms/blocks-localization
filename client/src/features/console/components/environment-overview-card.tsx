import { environmentOptions } from "@/features/console/constants/environment-options";
import type { IProject } from "@/features/console/model/project";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { useUilmProjectStore } from "@/features/uilm/state/uilm-project-store";
import { Card, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import { cn } from "@/platform/ui/lib/cn";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

type EnvironmentOverviewCardProps = {
  project: IProject;
  className?: string;
};

/** Parity: `identifier/components/project-group-overview/environment-card/environment-card.tsx` (compact row, env label, chevron on hover). */
export function EnvironmentOverviewCard({ project, className }: EnvironmentOverviewCardProps) {
  const navigate = useNavigate();
  const setSelectedProject = useConsoleProjectStore((s) => s.setSelectedProject);
  const setUilmProjectKey = useUilmProjectStore((s) => s.setProjectKey);

  const onClickHandler = (): void => {
    setSelectedProject(project);
    setUilmProjectKey(project.tenantId);
    void navigate("/services/language");
  };

  const envLabel =
    environmentOptions.find((option) => option.value === project.environment)?.label ?? project.environment;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClickHandler}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClickHandler();
        }
      }}
      className={cn(
        "group flex h-[60px] cursor-pointer flex-col justify-between rounded-sm border border-border !p-4 shadow-none transition-shadow duration-200 hover:shadow-md",
        className,
      )}
    >
      <CardHeader className="flex flex-row justify-between !p-0 !mb-0">
        <CardTitle className="line-clamp-1 break-all text-lg font-normal leading-tight !text-inherit">
          <div className="flex w-fit flex-row items-center gap-1">
            <div className="text-base text-medium-emphasis">{envLabel}</div>
          </div>
        </CardTitle>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </CardHeader>
    </Card>
  );
}
