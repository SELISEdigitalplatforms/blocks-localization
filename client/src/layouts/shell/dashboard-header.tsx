import { ConsoleEnvironmentListDropdown } from "@/features/console/components/console-environment-list-dropdown";
import { ConsoleProjectListDropdown } from "@/features/console/components/console-project-list-dropdown";
import { Button } from "@/platform/ui/components/button/button";
import { PanelLeft } from "lucide-react";
import { cn } from "@/platform/ui/lib/cn";
import { DashboardSidebarMobile } from "@/layouts/shell/components/dashboard-sidebar-mobile";
import { NotificationBellStub } from "@/layouts/shell/components/notification-bell-stub";
import { ShellLanguageSelector } from "@/layouts/shell/components/shell-language-selector";
import { ShellModeToggle } from "@/layouts/shell/components/shell-mode-toggle";
import { ShellUserMenu } from "@/layouts/shell/components/shell-user-menu";
import { useDashboardLayout } from "@/layouts/shell/dashboard-layout-context";

export function DashboardHeader() {
  const { isSidebarOpen, toggleSidebar } = useDashboardLayout();

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="shrink-0 md:hidden">
          <DashboardSidebarMobile />
        </div>
        <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className={cn("hidden shrink-0", !isSidebarOpen && "inline-flex")}
            onClick={toggleSidebar}
          >
            <PanelLeft className="h-6 w-6" />
          </Button>
          <div className="min-w-0 max-w-[min(18rem,58vw)] flex-1 md:max-w-[min(20rem,calc(100vw-14rem))]">
            <ConsoleProjectListDropdown />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-4">
        <div className="hidden h-fit max-w-40 md:flex">
          <ConsoleEnvironmentListDropdown />
        </div>
        <ShellModeToggle />
        <NotificationBellStub />
        <ShellLanguageSelector />
        <ShellUserMenu />
      </div>
    </header>
  );
}
