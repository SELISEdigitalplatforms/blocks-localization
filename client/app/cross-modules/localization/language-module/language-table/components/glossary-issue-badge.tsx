import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";
import type { IKeyGlossaryViolation } from "@blocks-localization/models/language";
import { formatViolationMessage } from "@blocks-localization/utils/glossary-validation";

export const getGlossaryIssueLabel = (count: number) =>
  `${count} glossary ${count === 1 ? "issue" : "issues"}`;

/** "<culture>: <message>" per stored violation, in the server's order. */
export const getGlossaryIssueLines = (violations: IKeyGlossaryViolation[]): string[] =>
  violations.map(
    ({ culture, glossaryId, term, kind, expected, found }) =>
      `${culture}: ${formatViolationMessage({ glossaryId, term, kind, expected, found })}`,
  );

/**
 * The violations the server stored for a key (Translate All, Key/Save recompute). Shown as
 * stored until the server recomputes them (C10). Renders nothing without violations.
 */
export function GlossaryIssueBadge({
  violations,
  className,
}: Readonly<{ violations: IKeyGlossaryViolation[] | undefined; className?: string }>) {
  if (!violations?.length) return null;
  const label = getGlossaryIssueLabel(violations.length);
  const lines = getGlossaryIssueLines(violations);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="warning"
            // Focusable so keyboard users can open the list; Radix links the content as its description.
            tabIndex={0}
            className={cn(
              "w-fit cursor-default gap-1 whitespace-nowrap rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
            data-testid="glossary-issue-badge"
          >
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-left">
          <ul className="space-y-0.5">
            {lines.map((line, index) => (
              // Lines can repeat (same message in two rows); the index keeps keys unique.
              // eslint-disable-next-line react/no-array-index-key
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
