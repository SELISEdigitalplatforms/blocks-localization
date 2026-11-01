import { BookText, Languages, Blocks, Cog, Home, Package, FileText, Puzzle } from "lucide-react";
import type { TFunction } from "@seliseblocks/genesis-os/i18n";
import { Menu } from "@/models/menu-models";

export const getNavigationMenus = (t: TFunction): Menu[] => [
  {
    id: "overview-project",
    type: "menu",
    name: t("NAVIGATION.OVERVIEW"),
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
    name: t("NAVIGATION.TRANSLATIONS"),
    path: "/app/services/language",
    icon: Languages,
  },
  {
    type: "menu",
    id: "service-localization__module",
    name: t("NAVIGATION.MODULES"),
    path: "/app/services/modules",
    icon: Blocks,
  },
  {
    type: "menu",
    id: "service-localization__glossary",
    name: t("NAVIGATION.GLOSSARY"),
    path: "/app/services/glossary",
    icon: BookText,
  },
  {
    type: "menu",
    id: "service-localization__language-configuration",
    name: t("NAVIGATION.CONFIGURATION"),
    path: "/app/services/configure",
    icon: Cog,
  },
  {
    type: "menu",
    id: "service-localization__extension-guides",
    name: t("NAVIGATION.EXTENSION_GUIDES"),
    path: "/app/services/extension-guides",
    icon: FileText,
  },
  {
    type: "menu",
    id: "service-localization__wordpress-plugin-guide",
    name: t("NAVIGATION.WORDPRESS_PLUGIN_GUIDE"),
    path: "/app/services/wordpress-plugin-guide",
    icon: Puzzle,
  },
  {
    id: "environments",
    type: "menu",
    name: t("NAVIGATION.ENVIRONMENTS"),
    path: "/app/project-overview/environments",
    icon: Package,
  },
];
