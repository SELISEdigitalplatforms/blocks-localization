import { BookText, Languages, Blocks, Cog } from "lucide-react";
import { Menu } from "@/models/menu-models";

export const navigationMenus: Menu[] = [
  {
    type: "menu",
    id: "service-localization__language",
    name: "Translations",
    path: "/services/language",
    icon: Languages,
  },
  {
    type: "menu",
    id: "service-localization__module",
    name: "Modules",
    path: "/services/modules",
    icon: Blocks,
  },
  {
    type: "menu",
    id: "service-localization__glossary",
    name: "Glossary",
    path: "/services/glossary",
    icon: BookText,
  },
  {
    type: "menu",
    id: "service-localization__language-configuration",
    name: "Configuration",
    path: "/services/configure",
    icon: Cog,
  },
];
