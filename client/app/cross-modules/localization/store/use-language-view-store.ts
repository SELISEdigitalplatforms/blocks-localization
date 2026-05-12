import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface LanguageViewState {
  selectedLanguages: string[];
  setSelectedLanguages: (languages: string[]) => void;
  toggleLanguage: (languageCode: string) => void;
  resetSelectedLanguages: () => void;
  selectedOptionalColumns: string[];
  setSelectedOptionalColumns: (columns: string[]) => void;
  toggleOptionalColumn: (column: string) => void;
  isHydrated: boolean;
  setIsHydrated: (hydrated: boolean) => void;
}

export const useLanguageViewStore = create<LanguageViewState>()(
  persist(
    (set) => ({
      selectedLanguages: [],
      isHydrated: false,

      setSelectedLanguages: (languages: string[]) => {
        set({ selectedLanguages: languages });
      },

      toggleLanguage: (languageCode: string) => {
        set((state) => ({
          selectedLanguages: state.selectedLanguages.includes(languageCode)
            ? state.selectedLanguages.filter((lang) => lang !== languageCode)
            : [...state.selectedLanguages, languageCode],
        }));
      },

      resetSelectedLanguages: () => {
        set({ selectedLanguages: [] });
        set({ selectedOptionalColumns: [] });
      },

      selectedOptionalColumns: [],

      setSelectedOptionalColumns: (columns: string[]) => {
        set({ selectedOptionalColumns: columns });
      },

      toggleOptionalColumn: (column: string) => {
        set((state) => ({
          selectedOptionalColumns: state.selectedOptionalColumns.includes(column)
            ? state.selectedOptionalColumns.filter((col) => col !== column)
            : [...state.selectedOptionalColumns, column],
        }));
      },

      setIsHydrated: (hydrated: boolean) => {
        set({ isHydrated: hydrated });
      },
    }),
    {
      name: "language-view-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Called after state is rehydrated from localStorage
        state?.setIsHydrated(true);
      },
    },
  ),
);
