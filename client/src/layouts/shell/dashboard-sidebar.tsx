import { cn } from "@/platform/ui/lib/cn";
import { Button } from "@/platform/ui/components/button/button";
import { Separator } from "@/platform/ui/components/separator/separator";
import { PanelLeft } from "lucide-react";
import { Fragment } from "react";
import { LogoBand } from "@/layouts/shell/components/logo-band";
import { DashboardNavMenuItem } from "@/layouts/shell/components/dashboard-nav-menu-item";
import { dashboardNavigationMenus } from "@/layouts/shell/navigation/dashboard-navigation-menus";
import { useDashboardLayout } from "@/layouts/shell/dashboard-layout-context";

export function DashboardSidebar() {
  const { isSidebarOpen, toggleSidebar } = useDashboardLayout();

  return (
    <div
      className={cn(
        "hidden h-[calc(100dvh)] min-h-0 shrink-0 self-stretch overflow-x-hidden border-r border-border bg-card transition-[width,min-width] duration-200 md:block",
        isSidebarOpen ? "min-w-60" : "w-14 max-w-14",
      )}
    >
      <div
        className={cn(
          "flex h-[60px] items-center border-b border-border",
          isSidebarOpen ? "justify-between gap-2 px-3" : "justify-center px-0",
        )}
      >
        <LogoBand
          variant={isSidebarOpen ? "wordmark" : "icon"}
          className={cn("border-0 !ml-0", isSidebarOpen ? "min-w-0 flex-1 !w-auto" : "shrink-0")}
        />
        {isSidebarOpen ? (
          <Button variant="ghost" size="icon" className="shrink-0" type="button" onClick={toggleSidebar}>
            <PanelLeft className="h-6 w-6" />
          </Button>
        ) : null}
      </div>
      <nav
        className={cn(
          "thin-scrollbar grid max-h-[calc(100dvh-60px)] gap-1 overflow-y-auto overflow-x-hidden text-sm",
          isSidebarOpen ? "p-2" : "px-0 py-2",
        )}
      >
        {dashboardNavigationMenus.map((entry) => (
          <Fragment key={entry.id}>
            {entry.type === "menu" ? <DashboardNavMenuItem menu={entry} isSidebarOpen={isSidebarOpen} /> : null}
            {entry.type === "separator" ? <Separator className="my-2" /> : null}
          </Fragment>
        ))}
      </nav>
    </div>
  );
}
