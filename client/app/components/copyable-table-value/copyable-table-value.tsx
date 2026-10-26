import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  valueStyle?: CSSProperties;
  valueTooltip?: string;
};

const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  throw new Error("Clipboard API not available");
};

// Touch devices have no hover, so the copy button is revealed by a long press instead.
const LONG_PRESS_DELAY_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

export function CopyableTableValue({
  value,
  displayValue,
  label,
  className,
  valueClassName,
  valueStyle,
  valueTooltip,
}: Readonly<CopyableTableValueProps>) {
  const [isCopied, setIsCopied] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const copyValue = value ?? "";
  const renderedValue = (
    <span className={cn("min-w-0 max-w-full", valueClassName)} style={valueStyle}>
      {displayValue ?? copyValue}
    </span>
  );

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    },
    [],
  );

  // Hide the long-press revealed button again once the user taps anywhere else.
  useEffect(() => {
    if (!isRevealed) return;

    const handleOutsidePointerDown = (event: globalThis.PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsRevealed(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [isRevealed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !copyValue) return;

    const cancelLongPress = () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      longPressStartRef.current = null;
    };

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      didLongPressRef.current = false;
      if (event.pointerType === "mouse") return;
      // Presses on the copy button itself must not start a long press.
      if (copyButtonRef.current?.contains(event.target as Node)) return;

      cancelLongPress();
      longPressStartRef.current = { x: event.clientX, y: event.clientY };
      longPressTimerRef.current = setTimeout(() => {
        didLongPressRef.current = true;
        longPressTimerRef.current = null;
        setIsRevealed(true);
      }, LONG_PRESS_DELAY_MS);
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const start = longPressStartRef.current;
      if (!start) return;

      const movedX = Math.abs(event.clientX - start.x);
      const movedY = Math.abs(event.clientY - start.y);
      if (movedX > LONG_PRESS_MOVE_TOLERANCE_PX || movedY > LONG_PRESS_MOVE_TOLERANCE_PX) {
        cancelLongPress();
      }
    };

    // A long press must only reveal the button, not open the row it sits in.
    const handleClickCapture = (event: globalThis.MouseEvent) => {
      if (!didLongPressRef.current) return;

      didLongPressRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };

    const handleContextMenu = (event: globalThis.MouseEvent) => {
      if (longPressStartRef.current || didLongPressRef.current) event.preventDefault();
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", cancelLongPress);
    container.addEventListener("pointercancel", cancelLongPress);
    container.addEventListener("pointerleave", cancelLongPress);
    container.addEventListener("click", handleClickCapture, true);
    container.addEventListener("contextmenu", handleContextMenu);

    return () => {
      cancelLongPress();
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", cancelLongPress);
      container.removeEventListener("pointercancel", cancelLongPress);
      container.removeEventListener("pointerleave", cancelLongPress);
      container.removeEventListener("click", handleClickCapture, true);
      container.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [copyValue]);

  const handleCopy = async () => {
    if (!copyValue) return;

    try {
      await copyText(copyValue);
      setIsCopied(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setIsCopied(false);
        setIsRevealed(false);
      }, 2000);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={containerRef}
        className={cn(
          "group/copy flex min-w-0 items-center gap-1 [@media(hover:none)]:select-none [@media(hover:none)]:[-webkit-touch-callout:none]",
          className,
        )}
      >
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
                ref={copyButtonRef}
                type="button"
                variant="ghost"
                size="icon"
                data-revealed={isRevealed}
                className="pointer-events-none h-7 w-7 shrink-0 opacity-0 transition-opacity group-focus-within/copy:pointer-events-auto group-focus-within/copy:opacity-100 data-[revealed=true]:pointer-events-auto data-[revealed=true]:opacity-100 [@media(hover:hover)]:group-hover/copy:pointer-events-auto [@media(hover:hover)]:group-hover/copy:opacity-100"
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
