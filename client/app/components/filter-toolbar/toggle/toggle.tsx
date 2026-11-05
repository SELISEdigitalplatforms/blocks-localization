import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-kits/button/button";
import { Separator } from "@/components/ui-kits/separator/separator";
import { Badge, type BadgeProps } from "@/components/ui-kits/badge/badge";

interface ToggleProps {
  label?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: ComponentType<{ className?: string }>;
  /** Shown as a badge after the label; hidden while undefined (e.g. still loading). */
  count?: number;
  /** Semantic treatment for the count; neutral by default. */
  countVariant?: BadgeProps["variant"];
}

/** An on/off filter styled like the other filter buttons: one click turns it on, another turns it off. */
export function Toggle({
  label,
  value,
  onChange,
  disabled = false,
  icon: Icon,
  count,
  countVariant = "secondary",
}: Readonly<ToggleProps>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={value}
      className={cn("h-8 border-dashed", value && "border-solid border-primary bg-accent")}
      onClick={() => onChange(!value)}
      disabled={disabled}
    >
      <div className="flex items-center">
        {Icon && <Icon className="mr-2 h-4 w-4" />}
        <span>{label}</span>
        {count !== undefined && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <Badge
              variant={countVariant}
              className="min-w-6 rounded-sm px-1.5 font-medium tabular-nums"
            >
              {count}
            </Badge>
          </>
        )}
      </div>
    </Button>
  );
}
