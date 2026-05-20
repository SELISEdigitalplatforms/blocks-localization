import { DashboardLayoutProvider } from "@/contexts/dashboard-layout-provider";
import { ImpersonationChecker, ProtectedGuard } from "@/guards/protected-guard";
import { DashboardHeader } from "@/layouts/dashboard-header/dashboard-header";
import { SidebarMenuDesktop } from "@/layouts/sidebar-menu-desktop/sidebar-menu-desktop";
import { Outlet } from "react-router-dom";
export function DashboardLayout() {
  return (
    <ProtectedGuard>
      <ImpersonationChecker>
        <DashboardLayoutProvider isOpen={true} persist>
          <div className='relative flex h-screen overflow-hidden bg-[hsl(var(--surface-app))]'>
            <SidebarMenuDesktop />
            <div className='flex min-w-0 flex-1 flex-col overflow-hidden'>
              <DashboardHeader />
              <main className='flex-1 overflow-y-auto overflow-x-hidden'>
                <Outlet />
              </main>
            </div>
          </div>
        </DashboardLayoutProvider>
      </ImpersonationChecker>
    </ProtectedGuard>
  )
}