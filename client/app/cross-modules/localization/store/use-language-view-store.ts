import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getCookie, setJsonCookie, removeCookie } from "@/lib/cookie";

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
  return VALID_OPTIONAL_COLUMNS.includes(column as (typeof VALID_OPTIONAL_COLUMNS)[number]);
};

interface LanguageViewState {
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
  hasStoredViewSettings: boolean;
}

let skipNextPersist = false;

const setStateWithoutPersist = (state: Partial<LanguageViewState>, replace?: false) => {
  skipNextPersist = true;
  try {
    useLanguageViewStore.setState(state, replace);
  } finally {
    skipNextPersist = false;
  }
};

// Helper to read cookie data for a specific tenantId
// This is used by both the storage adapter and manual rehydration
const getStoredDataForTenant = (tenantId: string) => {
  if (!tenantId) return null;

  try {
    const value = getCookie(COOKIE_NAME);
    if (!value) return null;

    const parsed = JSON.parse(decodeURIComponent(value)) as Record<
      string,
      {
        selectedLanguages?: string[];
        selectedOptionalColumns?: string[];
      }
    >;

    const tenantSettings = parsed[tenantId];
    if (!tenantSettings) return null;

    return {
      selectedLanguages: (tenantSettings.selectedLanguages || []).filter(isValidLanguageCode),
      selectedOptionalColumns: (tenantSettings.selectedOptionalColumns || []).filter(
        isValidOptionalColumn,
      ),
    };
  } catch {
    return null;
  }
};

// Custom storage adapter using cookies for cross-subdomain persistence
// Stores view settings per tenantId (project)
const cookieStorage = {
  getItem: (): string | null => {
    // NOTE: This is called during zustand persist's automatic rehydration
    // which happens BEFORE we can set the correct tenantId.
    // We return null here to prevent incorrect rehydration.
    // Manual rehydration is done via rehydrateLanguageViewStore() AFTER setting tenantId.
    return null;
  },
  setItem: (name: string, value: string): void => {
    try {
      if (skipNextPersist) return;

      const parsed = JSON.parse(value);
      // Note: tenantId is NOT persisted anymore - it's controlled by the component
      const selectedLanguages = parsed.state?.selectedLanguages || [];
      const selectedOptionalColumns = parsed.state?.selectedOptionalColumns || [];

      // Get tenantId from the store's current state
      const currentState = useLanguageViewStore.getState();
      const tenantId = currentState.tenantId;

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
          selectedLanguages: selectedLanguages.filter(isValidLanguageCode),
          selectedOptionalColumns: selectedOptionalColumns.filter(isValidOptionalColumn),
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
    (set) => ({
      tenantId: "",
      selectedLanguages: [],
      isHydrated: false,
      hasStoredViewSettings: false,

      setSelectedLanguages: (languages: string[]) => {
        // Only accept valid language codes
        const validLanguages = languages.filter(isValidLanguageCode);
        set({
          selectedLanguages: validLanguages,
          hasStoredViewSettings: true,
        });
      },

      toggleLanguage: (languageCode: string) => {
        // Only allow valid language codes
        if (!isValidLanguageCode(languageCode)) return;

        set((state) => ({
          selectedLanguages: state.selectedLanguages.includes(languageCode)
            ? state.selectedLanguages.filter((lang) => lang !== languageCode)
            : [...state.selectedLanguages, languageCode],
          hasStoredViewSettings: true,
        }));
      },

      resetSelectedLanguages: () => {
        set({
          selectedLanguages: [],
          selectedOptionalColumns: [],
          hasStoredViewSettings: true,
        });
      },

      selectedOptionalColumns: [],

      setSelectedOptionalColumns: (columns: string[]) => {
        // Only accept valid column values
        const validColumns = columns.filter(isValidOptionalColumn);
        set({
          selectedOptionalColumns: validColumns,
          hasStoredViewSettings: true,
        });
      },

      toggleOptionalColumn: (column: string) => {
        // Only allow valid column values
        if (!isValidOptionalColumn(column)) return;

        set((state) => ({
          selectedOptionalColumns: state.selectedOptionalColumns.includes(column)
            ? state.selectedOptionalColumns.filter((col) => col !== column)
            : [...state.selectedOptionalColumns, column],
          hasStoredViewSettings: true,
        }));
      },

      setIsHydrated: (hydrated: boolean) => {
        set({ isHydrated: hydrated });
      },
    }),
    {
      name: COOKIE_NAME,
      storage: createJSONStorage(() => cookieStorage),
      // IMPORTANT: Skip automatic rehydration to prevent race condition
      // We manually rehydrate via rehydrateLanguageViewStore() AFTER setting tenantId
      skipHydration: true,
      // Only persist language settings, NOT tenantId
      // tenantId is controlled entirely by the component
      partialize: (state) => ({
        selectedLanguages: state.selectedLanguages,
        selectedOptionalColumns: state.selectedOptionalColumns,
      }),
    },
  ),
);

/**
 * Manually rehydrate the store for a specific tenantId
 * Call this AFTER updateLanguageViewTenantId() to load the correct tenant's settings
 */
export const rehydrateLanguageViewStore = () => {
  const state = useLanguageViewStore.getState();
  const storedData = getStoredDataForTenant(state.tenantId);

  if (storedData) {
    setStateWithoutPersist({
      ...storedData,
      isHydrated: true,
      hasStoredViewSettings: true,
    });
  } else {
    // No stored data for this tenant, use defaults
    setStateWithoutPersist({
      selectedLanguages: [],
      selectedOptionalColumns: [],
      isHydrated: true,
      hasStoredViewSettings: false,
    });
  }
};

/**
 * Update tenantId and load the corresponding tenant's stored settings
 * This should be called when switching projects
 */
export const updateLanguageViewTenantId = (tenantId: string) => {
  setStateWithoutPersist({
    tenantId,
    isHydrated: false,
    hasStoredViewSettings: false,
  });
  // After setting tenantId, manually rehydrate to get the correct tenant's settings
  rehydrateLanguageViewStore();
};
