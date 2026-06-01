import { useState } from "react";
import { ExternalLink, Server, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { IProject } from "@blocks-identifier/models/project.model";
import { useProjectStore } from "@/store/useProjectStore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { environmentOptions } from "@/constants/environment-options";

type EnvironmentCardProps = {
  project: IProject;
  isMigrationOngoing?: boolean;
  className?: string;
};

export const EnvironmentCard = ({
  project,
  isMigrationOngoing,
  className,
}: EnvironmentCardProps) => {
  const navigate = useNavigate();
  const { setSelectedProject } = useProjectStore();
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const environmentOption = environmentOptions.find(
    (option) => option.value === project?.environment,
  );

  const onClickHandler = (): void => {
    setSelectedProject(project);
    navigate("/services/language");
  };

  const handleCardClick = (): void => {
    if (isMigrationOngoing) {
      setIsConfirmationOpen(true);
      return;
    }
    onClickHandler();
  };

  const handleConfirm = (): void => {
    setIsConfirmationOpen(false);
    onClickHandler();
  };

  return (
    <Dialog open={isConfirmationOpen} onOpenChange={setIsConfirmationOpen}>
      <Card
        className={`group cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-lg ${className}`}
      >
        <CardContent className="p-0">
          {/* Top section with icon */}
          <div
            className="flex h-24 cursor-pointer flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10"
            onClick={handleCardClick}
          >
            <div className="rounded-full bg-background p-3 shadow-sm">
              <Server className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* Content section */}
          <div className="p-4">
            {/* Environment name and status */}
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-[hsl(var(--high-emphasis))]">
                {environmentOption?.label || project.environment}
              </h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      {isMigrationOngoing ? (
                        <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isMigrationOngoing ? "Migration in progress" : "Active"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Details */}
            <div className="mb-4 space-y-1">
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--medium-emphasis))]">
                <span className="font-medium">X-Blocks-Key:</span>
                <span className="truncate font-mono">{project?.tenantId}</span>
              </div>
              {project.domain && (
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--medium-emphasis))]">
                  <span className="font-medium">Domain:</span>
                  <span className="truncate">{project.domain}</span>
                </div>
              )}
            </div>

            {/* Open Dashboard link */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              Open Dashboard
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
      {isMigrationOngoing && (
        <ConfirmationModal
          onCancel={() => setIsConfirmationOpen(false)}
          onConfirm={handleConfirm}
          data={{
            dialogTitle: "Environment Migration in Progress",
            dialogSubtitle:
              "This environment is currently migrating. Any changes now may cause incomplete data or service interruptions. Proceed only if necessary.",
            confirmButton: "Continue Anyway",
            cancelButton: "Cancel",
          }}
        />
      )}
    </Dialog>
  );
};
