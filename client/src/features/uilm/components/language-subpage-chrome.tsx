import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type LanguageSubpageChromeProps = {
  title: string;
  description?: string;
  /** e.g. back control beside the title (monolith export-history pattern). */
  leading?: ReactNode;
  /** e.g. primary action aligned with the title row (New key Save button). */
  actions?: ReactNode;
  children: ReactNode;
};

export function LanguageSubpageChrome({
  title,
  description,
  leading,
  actions,
  children,
}: LanguageSubpageChromeProps) {
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link to="/services/language" className="font-medium text-primary hover:underline">
          Language
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-foreground">{title}</span>
      </nav>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-high-emphasis md:text-3xl">
              {title}
            </h1>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
