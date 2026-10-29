import { Archive, CheckCircle2, LucideIcon, PencilLine } from "lucide-react";
import { Badge, BadgeProps } from "@/components/ui-kits/badge/badge";
import { cn } from "@/lib/utils";
import { GlossaryStatus } from "@blocks-localization/models/language";

const STATUS_DISPLAY: Record<
  GlossaryStatus,
  { label: string; variant: BadgeProps["variant"]; Icon: LucideIcon }
> = {
  approved: { label: "Approved", variant: "success", Icon: CheckCircle2 },
  draft: { label: "Draft", variant: "outline", Icon: PencilLine },
  deprecated: { label: "Deprecated", variant: "secondary", Icon: Archive },
};

export const GLOSSARY_STATUS_LABELS: Record<GlossaryStatus, string> = {
  approved: STATUS_DISPLAY.approved.label,
  draft: STATUS_DISPLAY.draft.label,
  deprecated: STATUS_DISPLAY.deprecated.label,
};

interface GlossaryStatusBadgeProps {
  status: GlossaryStatus;
  className?: string;
}

/** Always icon + text, so the status never depends on colour alone. */
const GlossaryStatusBadge = ({ status, className }: Readonly<GlossaryStatusBadgeProps>) => {
  const { label, variant, Icon } = STATUS_DISPLAY[status];
  return (
    <Badge variant={variant} className={cn("w-fit gap-1", className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
};

export default GlossaryStatusBadge;
