import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/platform/ui/components/dropdown-menu/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const languages = [
  { key: "en", title: "English" },
  { key: "de", title: "German" },
  { key: "fr", title: "French" },
] as const;

export function ShellLanguageSelector() {
  const [language, setLanguage] = useState<string>("en");

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent">
          <span className="text-sm font-medium uppercase">{language}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.key}
            className={lang.key === language ? "font-bold" : ""}
            disabled={lang.key !== "en"}
            onClick={() => setLanguage(lang.key)}
          >
            {lang.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
