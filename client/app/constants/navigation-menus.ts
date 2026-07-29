import { BookText, Languages, Blocks, Cog, Home, Package, FileText } from "lucide-react";
import { Menu } from "@/models/menu-models";

export const navigationMenus: Menu[] = [
  {
    id: "overview-project",
    type: "menu",
    name: "Overview",
    path: "/app/dashboard",
    icon: Home,
  },
  {
    type: "separator",
    id: "separator-overview",
  },
  {
    type: "menu",
    id: "service-localization__language",
    name: "Translations",
    path: "/app/services/language",
    icon: Languages,
  },
  {
    type: "menu",
    id: "service-localization__module",
    name: "Modules",
    path: "/app/services/modules",
    icon: Blocks,
  },
  {
    type: "menu",
    id: "service-localization__glossary",
    name: "Glossary",
    path: "/app/services/glossary",
    icon: BookText,
  },
  {
    type: "menu",
    id: "service-localization__language-configuration",
    name: "Configuration",
    path: "/app/services/configure",
    icon: Cog,
  },
  {
    type: "menu",
    id: "service-localization__extension-guides",
    name: "Extension Guides",
    path: "/app/services/extension-guides",
    icon: FileText,
  },
  {
    id: "environments",
    type: "menu",
    name: "Environments",
    path: "/app/project-overview/environments",
    icon: Package,
  },
];
