import { BookText, Languages } from "lucide-react";
import { Menu } from "@/models/menu-models";

export const navigationMenus: Menu[] = [
  {
    type: "menu",
    id: "service-localization__language",
    name: "Language",
    path: "/services/language",
    icon: Languages,
  },
  {
    type: "menu",
    id: "service-localization__glossary",
    name: "Glossary",
    path: "/services/glossary",
    icon: BookText,
  },
];
