import { environmentOptions } from "@/features/console/constants/environment-options";
import type { IProject } from "@/features/console/model/project";
import { Badge } from "@/platform/ui/components/badge/badge";
import { Card, CardFooter, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/platform/ui/components/tooltip/tooltip";
import { Link } from "react-router-dom";

type ConsoleProjectCardProps = {
  project: IProject;
  envList: string[];
  /** Runs before navigation (project / tenant selection for UILM + console store). */
  onActivate?: () => void;
};

function envLabel(value: string): string {
  return environmentOptions.find((o) => o.value === value)?.label ?? value;
}

/** Card-only layout matching Next `ProjectCard` (no secondary “Open in Blocks” link under the card). */
export function ConsoleProjectCard({ project, envList, onActivate }: ConsoleProjectCardProps) {
  return (
    <Link
      to="/project-overview/environments"
      className="block"
      onClick={() => {
        onActivate?.();
      }}
    >
      <Card className="flex h-[160px] cursor-pointer flex-col justify-between rounded-sm border border-border bg-card p-4 shadow-none transition-shadow duration-200 hover:shadow-md">
        <CardHeader className="flex flex-col space-y-1 !p-0">
          <CardTitle className="line-clamp-2 break-all text-lg leading-tight">{project.name}</CardTitle>
        </CardHeader>
        <CardFooter className="flex items-center justify-between p-0">
          <div>
            {envList.length > 0 ? (
              envList.length > 3 ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline">
                        {envList.slice(0, 3).map((env) => (
                          <Badge key={env} variant="secondary" className="mb-2 mr-2 inline-flex items-center">
                            {envLabel(env)}
                          </Badge>
                        ))}
                        <Badge variant="secondary" className="inline-flex cursor-pointer items-center">
                          ...
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="flex flex-col flex-wrap gap-2">
                        {envList.map((env) => (
                          <Badge key={env} variant="secondary" className="inline-flex items-center">
                            {envLabel(env)}
                          </Badge>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                envList.map((env) => (
                  <Badge key={env} variant="secondary" className="mb-2 mr-2 inline-flex items-center">
                    {envLabel(env)}
                  </Badge>
                ))
              )
            ) : (
              <Badge variant="secondary" className="inline-flex items-center">
                No environments selected
              </Badge>
            )}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
