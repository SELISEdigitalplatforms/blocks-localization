
import { cn } from "@/platform/ui/lib/cn";
import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";

type Props = {
  textToCopy: string;
  children: ReactNode;
  isHoverable?: boolean;
  className?: string;
};

export function ProfileCopyToClipboardButton({ textToCopy, children, isHoverable, className }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const ta = document.createElement("textarea");
        ta.value = textToCopy;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex max-w-full items-center gap-2 text-left",
        isHoverable && "rounded-sm hover:bg-muted/80",
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {copied ? (
        <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
      ) : (
        <Copy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </button>
  );
}
