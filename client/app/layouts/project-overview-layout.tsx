import { Outlet } from "react-router-dom";
import { ProtectedGuard } from "@/guards/protected-guard";
import { ProjectOverviewSidebarDesktop } from "@/layouts/project-overview-sidebar/project-overview-sidebar-desktop";
import { ProjectOverviewSidebarMobile } from "@/layouts/project-overview-sidebar/project-overview-sidebar-mobile";
import { DashboardHeader } from "@/layouts/dashboard-header/dashboard-header";
import { ConsoleHeader } from "@/layouts/console-header/console-header";

export function ProjectOverviewLayout() {
  return (
    <ProtectedGuard>
      <div className="relative flex h-screen overflow-hidden bg-[hsl(var(--surface-app))]">
        {/* Desktop sidebar */}
        <ProjectOverviewSidebarDesktop />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ConsoleHeader />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ProtectedGuard>
  );
}
