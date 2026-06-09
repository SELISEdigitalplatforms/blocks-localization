import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getCookie, setJsonCookie, removeCookie } from "@/lib/cookie";

const COOKIE_NAME = "language-view-storage";
const COOKIE_DAYS = 365;

// Valid optional column values
const VALID_OPTIONAL_COLUMNS = [
  "completeness",
  "createDate",
  "lastUpdateDate",
] as const;

// Validate and sanitize language codes (ISO format like "en-US", "bn-BD")
const isValidLanguageCode = (code: string): boolean => {
  return typeof code === "string" && /^[a-z]{2}-[A-Z]{2}$/.test(code);
};

// Validate optional column values
const isValidOptionalColumn = (column: string): boolean => {
  return VALID_OPTIONAL_COLUMNS.includes(
    column as (typeof VALID_OPTIONAL_COLUMNS)[number],
  );
};

interface LanguageViewState {
  // Include tenantId in state so persist middleware can detect project changes
  tenantId: string;
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
// Stores view settings per tenantId (project)
const cookieStorage = {
  getItem: (): string | null => {
    try {
      const value = getCookie(COOKIE_NAME);
      if (!value) return null;

      // Parse the stored data - it contains all tenant settings
      const parsed = JSON.parse(decodeURIComponent(value)) as Record<
        string,
        {
          selectedLanguages?: string[];
          selectedOptionalColumns?: string[];
        }
      >;

      // Get tenantId from the state being rehydrated (passed via the value parameter)
      // The value contains the full persisted state including tenantId
      const stateValue = JSON.parse(value);
      const tenantId = stateValue?.state?.tenantId || "";

      // If no tenantId in state, return null to use defaults
      if (!tenantId) return null;

      // Get the settings for the current tenant, or use defaults
      const tenantSettings = parsed[tenantId] || {
        selectedLanguages: [],
        selectedOptionalColumns: [],
      };

      // Validate and sanitize data on read
      const sanitized = {
        state: {
          tenantId,
          selectedLanguages: (tenantSettings.selectedLanguages || []).filter(
            isValidLanguageCode,
          ),
          selectedOptionalColumns: (
            tenantSettings.selectedOptionalColumns || []
          ).filter(isValidOptionalColumn),
        },
        version: 0,
      };

      return JSON.stringify(sanitized);
    } catch {
      // If parsing fails, return null to use default state
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      const parsed = JSON.parse(value);
      const tenantId = parsed.state?.tenantId || "";

      // If no tenantId, don't store anything
      if (!tenantId) return;

      // Get existing stored data
      const existingData = (() => {
        const cookieValue = getCookie(COOKIE_NAME);
        if (!cookieValue) return {};
        try {
          return JSON.parse(decodeURIComponent(cookieValue)) || {};
        } catch {
          return {};
        }
      })();

      // Update only the current tenant's settings
      const validated = {
        ...existingData,
        [tenantId]: {
          selectedLanguages: (parsed.state?.selectedLanguages || []).filter(
            isValidLanguageCode,
          ),
          selectedOptionalColumns: (
            parsed.state?.selectedOptionalColumns || []
          ).filter(isValidOptionalColumn),
        },
      };

      setJsonCookie(COOKIE_NAME, validated, COOKIE_DAYS);
    } catch {
      // If parsing fails, do nothing
    }
  },
  removeItem: (): void => {
    removeCookie(COOKIE_NAME);
  },
};

export const useLanguageViewStore = create<LanguageViewState>()(
  persist(
    (set, get) => ({
      tenantId: "",
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
        set({ selectedLanguages: [], selectedOptionalColumns: [] });
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
          selectedOptionalColumns: state.selectedOptionalColumns.includes(
            column,
          )
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
      // Partialize to only persist selectedLanguages and selectedOptionalColumns
      // tenantId is used for cookie key lookup but not persisted as part of state
      partialize: (state) => ({
        tenantId: state.tenantId,
        selectedLanguages: state.selectedLanguages,
        selectedOptionalColumns: state.selectedOptionalColumns,
      }),
    },
  ),
);

// Helper function to update tenantId and trigger re-persist
// Call this when the project changes to ensure correct settings are loaded
export const updateLanguageViewTenantId = (tenantId: string) => {
  useLanguageViewStore.setState({
    tenantId,
    selectedLanguages: [],
    selectedOptionalColumns: [],
  });
};
