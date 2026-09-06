import type { FC } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";

type CopyableSnippetProps = {
  id: string;
  label: string;
  value: string;
  copiedField: string | null;
  onCopy: (value: string, id: string) => void;
  className?: string;
  displayValue?: string;
};

export const CopyableSnippet: FC<CopyableSnippetProps> = ({
  id,
  label,
  value,
  copiedField,
  onCopy,
  className,
  displayValue,
}) => {
  const isCopied = copiedField === id;
  const isAvailable = Boolean(value);

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {isCopied ? "Copied" : ""}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/60 p-2 pl-3">
        <code className="min-w-0 flex-1 whitespace-pre-wrap break-all text-xs text-foreground sm:text-sm">
          {isAvailable ? (displayValue ?? value) : "Value is not configured"}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={!isAvailable}
          aria-label={`Copy ${label}`}
          title={`Copy ${label}`}
          onClick={() => onCopy(value, id)}
        >
          {isCopied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
