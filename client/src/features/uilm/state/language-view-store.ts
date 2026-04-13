import { create } from "zustand";

export type OptionalColumnId = "completeness" | "createDate" | "lastUpdateDate";

type LanguageViewState = {
  selectedLanguages: string[];
  setSelectedLanguages: (languages: string[]) => void;
  toggleLanguage: (languageCode: string) => void;
  selectedOptionalColumns: OptionalColumnId[];
  toggleOptionalColumn: (column: OptionalColumnId) => void;
};

export const useLanguageViewStore = create<LanguageViewState>((set) => ({
  selectedLanguages: [],
  setSelectedLanguages: (languages) => set({ selectedLanguages: languages }),
  toggleLanguage: (languageCode) =>
    set((state) => ({
      selectedLanguages: state.selectedLanguages.includes(languageCode)
        ? state.selectedLanguages.filter((c) => c !== languageCode)
        : [...state.selectedLanguages, languageCode],
    })),
  selectedOptionalColumns: [],
  toggleOptionalColumn: (column) =>
    set((state) => ({
      selectedOptionalColumns: state.selectedOptionalColumns.includes(column)
        ? state.selectedOptionalColumns.filter((c) => c !== column)
        : [...state.selectedOptionalColumns, column],
    })),
}));
