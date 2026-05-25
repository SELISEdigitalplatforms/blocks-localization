import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getJsonCookie, setJsonCookie, removeCookie, setCookie } from "@/lib/cookie";

const COOKIE_NAME = "language-view-storage";
const COOKIE_DAYS = 365;

// Valid optional column values
const VALID_OPTIONAL_COLUMNS = ["completeness", "createDate", "lastUpdateDate"] as const;

// Validate and sanitize language codes (ISO format like "en-US", "bn-BD")
const isValidLanguageCode = (code: string): boolean => {
  return typeof code === "string" && /^[a-z]{2}-[A-Z]{2}$/.test(code);
};

// Validate optional column values
const isValidOptionalColumn = (column: string): boolean => {
  return VALID_OPTIONAL_COLUMNS.includes(column as typeof VALID_OPTIONAL_COLUMNS[number]);
};

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

// Custom storage adapter using cookies for cross-subdomain persistence
// TODO: Re-enable cookie storage after OIDC work is complete
const cookieStorage = {
  getItem: (): string | null => {
    // Temporarily disabled for OIDC work
    return null;
    // const value = getJsonCookie<{ state: { selectedLanguages: string[]; selectedOptionalColumns: string[] }; version: number }>(COOKIE_NAME);
    // if (!value) return null;

    // // Validate and sanitize data on read
    // const sanitized = {
    //   state: {
    //     selectedLanguages: (value.state?.selectedLanguages || []).filter(isValidLanguageCode),
    //     selectedOptionalColumns: (value.state?.selectedOptionalColumns || []).filter(isValidOptionalColumn),
    //   },
    //   version: value.version || 0,
    // };

    // return JSON.stringify(sanitized);
  },
  setItem: (name: string, value: string): void => {
    // Temporarily disabled for OIDC work
    return;
    // try {
    //   const parsed = JSON.parse(value);
    //   // Additional validation on write
    //   const validated = {
    //     ...parsed,
    //     state: {
    //       selectedLanguages: (parsed.state?.selectedLanguages || []).filter(isValidLanguageCode),
    //       selectedOptionalColumns: (parsed.state?.selectedOptionalColumns || []).filter(isValidOptionalColumn),
    //     },
    //   };
    //   setJsonCookie(COOKIE_NAME, validated, COOKIE_DAYS);
    // } catch {
    //   // If parsing fails, store as-is
    //   setCookie(COOKIE_NAME, value, COOKIE_DAYS);
    // }
  },
  removeItem: (): void => {
    // Temporarily disabled for OIDC work
    return;
    // removeCookie(COOKIE_NAME);
  },
};

export const useLanguageViewStore = create<LanguageViewState>()(
  persist(
    (set) => ({
      selectedLanguages: [],
      isHydrated: false,

      setSelectedLanguages: (languages: string[]) => {
        // Only accept valid language codes
        const validLanguages = languages.filter(isValidLanguageCode);
        set({ selectedLanguages: validLanguages });
      },

      toggleLanguage: (languageCode: string) => {
        // Only allow valid language codes
        if (!isValidLanguageCode(languageCode)) return;

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
        // Only accept valid column values
        const validColumns = columns.filter(isValidOptionalColumn);
        set({ selectedOptionalColumns: validColumns });
      },

      toggleOptionalColumn: (column: string) => {
        // Only allow valid column values
        if (!isValidOptionalColumn(column)) return;

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
      name: COOKIE_NAME,
      storage: createJSONStorage(() => cookieStorage),
      onRehydrateStorage: () => (state) => {
        // Called after state is rehydrated from cookie
        state?.setIsHydrated(true);
      },
    },
  ),
);
