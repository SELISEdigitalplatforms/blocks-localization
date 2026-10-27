import { Ban, Languages, Lock, LucideIcon } from "lucide-react";
import { Badge, BadgeProps } from "@/components/ui-kits/badge/badge";
import { cn } from "@/lib/utils";
import { GlossaryRule } from "@blocks-localization/models/glossary-meta";

const RULE_DISPLAY: Record<
  GlossaryRule,
  { label: string; variant: BadgeProps["variant"]; Icon: LucideIcon }
> = {
  translate: { label: "Translate", variant: "secondary", Icon: Languages },
  keep: { label: "Keep", variant: "info", Icon: Lock },
  forbidden: { label: "Forbidden", variant: "error", Icon: Ban },
};

export const GLOSSARY_RULE_LABELS: Record<GlossaryRule, string> = {
  translate: RULE_DISPLAY.translate.label,
  keep: RULE_DISPLAY.keep.label,
  forbidden: RULE_DISPLAY.forbidden.label,
};

/** The rule's icon alone, for compact controls that already show the term. */
export const GlossaryRuleIcon = ({
  rule,
  className,
}: Readonly<{ rule: GlossaryRule; className?: string }>) => {
  const { Icon } = RULE_DISPLAY[rule];
  return <Icon className={cn("h-3 w-3", className)} aria-hidden="true" />;
};

interface GlossaryRuleBadgeProps {
  rule: GlossaryRule;
  className?: string;
}

const GlossaryRuleBadge = ({ rule, className }: Readonly<GlossaryRuleBadgeProps>) => {
  const { label, variant, Icon } = RULE_DISPLAY[rule];
  return (
    <Badge variant={variant} className={cn("w-fit gap-1", className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
};

export default GlossaryRuleBadge;
