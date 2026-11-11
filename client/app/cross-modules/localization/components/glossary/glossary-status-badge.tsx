import { Archive, CheckCircle2, LucideIcon, PencilLine } from "lucide-react";
import { tStatic, useT } from "@seliseblocks/genesis-os/i18n";
import { Badge, BadgeProps } from "@/components/ui-kits/badge/badge";
import { cn } from "@/lib/utils";
import { GlossaryStatus } from "@blocks-localization/models/language";

const STATUS_DISPLAY: Record<
  GlossaryStatus,
  { labelKey: string; variant: BadgeProps["variant"]; Icon: LucideIcon }
> = {
  approved: { labelKey: "GLOSSARY_STATUS_BADGE.APPROVED", variant: "success", Icon: CheckCircle2 },
  draft: { labelKey: "GLOSSARY_STATUS_BADGE.DRAFT", variant: "outline", Icon: PencilLine },
  deprecated: { labelKey: "GLOSSARY_STATUS_BADGE.DEPRECATED", variant: "secondary", Icon: Archive },
};

// Getters, so each label is translated when it is shown, not at import time.
export const GLOSSARY_STATUS_LABELS: Record<GlossaryStatus, string> = {
  get approved() {
    return tStatic("localization.glossary", STATUS_DISPLAY.approved.labelKey);
  },
  get draft() {
    return tStatic("localization.glossary", STATUS_DISPLAY.draft.labelKey);
  },
  get deprecated() {
    return tStatic("localization.glossary", STATUS_DISPLAY.deprecated.labelKey);
  },
};

interface GlossaryStatusBadgeProps {
  status: GlossaryStatus;
  className?: string;
}

/** Always icon + text, so the status never depends on colour alone. */
const GlossaryStatusBadge = ({ status, className }: Readonly<GlossaryStatusBadgeProps>) => {
  const { t } = useT("localization.glossary");
  const { labelKey, variant, Icon } = STATUS_DISPLAY[status];
  return (
    <Badge
      variant={variant}
      className={cn(
        "w-fit gap-1 whitespace-nowrap",
        status === "approved" && "dark:bg-success/15 dark:text-success",
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(labelKey)}
    </Badge>
  );
};

export default GlossaryStatusBadge;
