import type { ILanguageConfig } from "@/features/uilm/types/language";
import {
  type OptionalColumnId,
  useLanguageViewStore,
} from "@/features/uilm/state/language-view-store";
import { Button } from "@/platform/ui/components/button/button";
import { Checkbox } from "@/platform/ui/components/checkbox/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/platform/ui/components/dropdown-menu/dropdown-menu";
import { Settings2 } from "lucide-react";

const OPTIONAL_LABELS: Record<OptionalColumnId, string> = {
  completeness: "Completeness",
  createDate: "Created Date",
  lastUpdateDate: "Last Updated Date",
};

type LanguageViewMenuProps = {
  /** UILM `/Api/Language/Gets` must return an array; bad hosts may return HTML/object — we coerce to []. */
  languages?: ILanguageConfig[] | null;
};

export function LanguageViewMenu({ languages }: LanguageViewMenuProps) {
  const list = Array.isArray(languages) ? languages : [];
  const selectedLanguages = useLanguageViewStore((s) => s.selectedLanguages);
  const toggleLanguage = useLanguageViewStore((s) => s.toggleLanguage);
  const setSelectedLanguages = useLanguageViewStore((s) => s.setSelectedLanguages);
  const selectedOptionalColumns = useLanguageViewStore((s) => s.selectedOptionalColumns);
  const toggleOptionalColumn = useLanguageViewStore((s) => s.toggleOptionalColumn);

  const allSelected = list.length > 0 && selectedLanguages.length === list.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <Settings2 className="h-4 w-4 lg:mr-2" />
          <span className="sr-only lg:not-sr-only">View</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="lang-select-all"
              checked={allSelected}
              onCheckedChange={() => {
                setSelectedLanguages(
                  allSelected ? [] : list.map((l) => l.languageCode),
                );
              }}
            />
            <label htmlFor="lang-select-all">Languages</label>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {list.map((lang) => (
          <DropdownMenuCheckboxItem
            key={lang.languageCode}
            checked={selectedLanguages.includes(lang.languageCode)}
            onCheckedChange={() => toggleLanguage(lang.languageCode)}
          >
            {lang.languageName}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        {(Object.keys(OPTIONAL_LABELS) as OptionalColumnId[]).map((col) => (
          <DropdownMenuCheckboxItem
            key={col}
            checked={selectedOptionalColumns.includes(col)}
            onCheckedChange={() => toggleOptionalColumn(col)}
          >
            {OPTIONAL_LABELS[col]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
