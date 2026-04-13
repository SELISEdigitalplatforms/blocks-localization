import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  itemId?: string;
} & Record<string, unknown>;

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  setAuthenticated: () => void;
  setUnAuthenticated: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      setUser: (user) => set((state) => ({ ...state, user })),
      setAuthenticated: () => set((state) => ({ ...state, isAuthenticated: true })),
      setUnAuthenticated: () => set((state) => ({ ...state, isAuthenticated: false, user: null })),
      reset: () => set({ isAuthenticated: false, user: null }),
    }),
    { name: "auth-storage" },
  ),
);
