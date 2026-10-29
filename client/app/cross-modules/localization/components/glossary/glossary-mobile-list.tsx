import { ReactNode } from "react";
import { Link } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os";
import { EllipsisVertical, Pencil, Trash } from "lucide-react";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { IGlossary, ILanguageConfig } from "@blocks-localization/models/language";
import GlossaryRuleBadge from "@blocks-localization/components/glossary/glossary-rule-badge";
import GlossaryStatusBadge from "@blocks-localization/components/glossary/glossary-status-badge";
import GlossaryTranslationChips from "@blocks-localization/components/glossary/glossary-translation-chips";
import {
  getGlossaryStatus,
  isUnsupportedGlossaryNote,
  toGlossaryMeta,
} from "@blocks-localization/utils/glossary-display";

const MOBILE_SKELETON_KEYS = Array.from({ length: 5 }, (_, index) => `glossary-card-${index}`);

export const getGlossaryScopeText = (glossary: IGlossary) => {
  if (glossary.isGlobal) return "Whole project";
  const count = glossary.moduleIds?.length ?? 0;
  return `${count} module${count === 1 ? "" : "s"}`;
};

interface GlossaryMobileListProps {
  glossaries: IGlossary[];
  languages: ILanguageConfig[] | undefined;
  isLoading: boolean;
  emptyState: ReactNode;
  onEdit: (glossary: IGlossary) => void;
  onDelete: (glossary: IGlossary) => void;
}

/** The glossary list below the `md` breakpoint: one card per term, same data and actions (H15). */
const GlossaryMobileList = ({
  glossaries,
  languages,
  isLoading,
  emptyState,
  onEdit,
  onDelete,
}: Readonly<GlossaryMobileListProps>) => {
  const scoped = useScopedPath();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {MOBILE_SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-28 w-full rounded-sm" />
        ))}
      </div>
    );
  }

  if (glossaries.length === 0) {
    return <div className="py-6 text-center">{emptyState}</div>;
  }

  return (
    <ul className="flex flex-col gap-3" aria-label="Glossary terms">
      {glossaries.map((glossary) => {
        const isUnsupported = isUnsupportedGlossaryNote(glossary);
        const meta = toGlossaryMeta(glossary);
        return (
          <li key={glossary.itemId}>
            <Card className="relative rounded-sm shadow-none focus-within:ring-2 focus-within:ring-ring">
              <CardContent className="grid gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={scoped(`services/glossary/${glossary.itemId}`)}
                    className="min-w-0 break-words font-medium text-high-emphasis after:absolute after:inset-0 focus-visible:outline-none"
                  >
                    {glossary.name}
                  </Link>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="relative z-10 h-8 w-8 shrink-0 p-0"
                        aria-label={`Actions for ${glossary.name}`}
                      >
                        <EllipsisVertical width={20} height={20} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="cursor-pointer" onClick={() => onEdit(glossary)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        <span>Edit</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-error"
                        onClick={() => onDelete(glossary)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!isUnsupported && <GlossaryRuleBadge rule={meta.rule} />}
                  <GlossaryStatusBadge status={getGlossaryStatus(glossary)} />
                  <span className="text-xs text-medium-emphasis">{getGlossaryScopeText(glossary)}</span>
                </div>
                {!isUnsupported && (
                  <div className="relative z-10 w-fit">
                    <GlossaryTranslationChips meta={meta} languages={languages} max={3} />
                  </div>
                )}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
};

export default GlossaryMobileList;
