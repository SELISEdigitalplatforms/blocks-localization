import { ProtectedRoute } from "@/routing/guards/protected-route";
import { DashboardGuard } from "@/routing/guards/dashboard-guard";
import { DashboardHeader } from "@/layouts/shell/dashboard-header";
import { DashboardLayoutProvider } from "@/layouts/shell/dashboard-layout-context";
import { DashboardSidebar } from "@/layouts/shell/dashboard-sidebar";
import { Outlet } from "react-router-dom";

export function DashboardShellLayout() {
  return (
    <ProtectedRoute>
      <DashboardGuard>
        <DashboardLayoutProvider>
          {/* Parity: `src/app/(main)/(home)/layout.tsx` — flex column, scroll only in inner main (cf. `PageSidebarProvider`). */}
          <div className="flex h-dvh w-full min-h-0 overflow-hidden bg-surface-app">
            <DashboardSidebar />
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <DashboardHeader />
              <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-surface-app">
                <main className="thin-scrollbar h-full w-full min-h-0 min-w-0 flex-1 overflow-auto overscroll-y-contain">
                  <Outlet />
                </main>
              </div>
            </div>
          </div>
        </DashboardLayoutProvider>
      </DashboardGuard>
    </ProtectedRoute>
  );
}
