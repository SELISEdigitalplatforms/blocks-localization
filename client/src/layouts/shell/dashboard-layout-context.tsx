import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type DashboardLayoutContextValue = {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
};

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null);

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const value = useMemo(
    () => ({
      isSidebarOpen,
      toggleSidebar: () => setSidebarOpen((o) => !o),
    }),
    [isSidebarOpen],
  );
  return <DashboardLayoutContext.Provider value={value}>{children}</DashboardLayoutContext.Provider>;
}

export function useDashboardLayout(): DashboardLayoutContextValue {
  const ctx = useContext(DashboardLayoutContext);
  if (!ctx) {
    throw new Error("useDashboardLayout must be used within DashboardLayoutProvider");
  }
  return ctx;
}
