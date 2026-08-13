import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui-kits/button/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";

type CopyableTableValueProps = {
  value: string | null | undefined;
  displayValue?: string;
  label: string;
  className?: string;
  valueClassName?: string;
  valueTooltip?: string;
};

const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  throw new Error("Clipboard API not available");
};

export function CopyableTableValue({
  value,
  displayValue,
  label,
  className,
  valueClassName,
  valueTooltip,
}: Readonly<CopyableTableValueProps>) {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyValue = value ?? "";
  const renderedValue = (
    <span className={cn("min-w-0 flex-1", valueClassName)}>{displayValue ?? copyValue}</span>
  );

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const handleCopy = async () => {
    if (!copyValue) return;

    try {
      await copyText(copyValue);
      setIsCopied(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("group flex min-w-0 items-center gap-1", className)}>
        {valueTooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>{renderedValue}</TooltipTrigger>
            <TooltipContent side="top">{valueTooltip}</TooltipContent>
          </Tooltip>
        ) : (
          renderedValue
        )}
        {copyValue && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-100 transition-opacity md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100"
                aria-label={`${isCopied ? "Copied" : "Copy"} ${label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleCopy();
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{isCopied ? "Copied" : `Copy ${label}`}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
