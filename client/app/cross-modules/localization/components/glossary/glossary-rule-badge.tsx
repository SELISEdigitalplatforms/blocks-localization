import { Ban, Languages, Lock, LucideIcon } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { Badge, BadgeProps } from "@/components/ui-kits/badge/badge";
import { cn } from "@/lib/utils";
import { GlossaryRule } from "@blocks-localization/models/glossary-meta";

const RULE_DISPLAY: Record<GlossaryRule, { variant: BadgeProps["variant"]; Icon: LucideIcon }> = {
  translate: { variant: "secondary", Icon: Languages },
  keep: { variant: "info", Icon: Lock },
  forbidden: { variant: "error", Icon: Ban },
};

export const useGlossaryRuleLabels = (): Record<GlossaryRule, string> => {
  const { t } = useT("localization.glossary");
  return {
    translate: t("GLOSSARY_RULE_BADGE.TRANSLATE"),
    keep: t("GLOSSARY_RULE_BADGE.KEEP"),
    forbidden: t("GLOSSARY_RULE_BADGE.FORBIDDEN"),
  };
};

interface GlossaryRuleBadgeProps {
  rule: GlossaryRule;
  className?: string;
}

const GlossaryRuleBadge = ({ rule, className }: Readonly<GlossaryRuleBadgeProps>) => {
  const labels = useGlossaryRuleLabels();
  const { variant, Icon } = RULE_DISPLAY[rule];
  const label = labels[rule];
  return (
    <Badge variant={variant} className={cn("w-fit gap-1", className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
};

export default GlossaryRuleBadge;
