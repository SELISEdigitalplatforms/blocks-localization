import { DashboardGuard } from "@/routing/guards/dashboard-guard";
import { ProtectedRoute } from "@/routing/guards/protected-route";
import { Button } from "@/platform/ui/components/button/button";
import { Separator } from "@/platform/ui/components/separator/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/platform/ui/components/sheet/sheet";
import { cn } from "@/platform/ui/lib/cn";
import type { LucideIcon } from "lucide-react";
import { BookMinus, Boxes, MenuIcon, Settings, Users, X } from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

/**
 * Parity targets:
 * - `src/layouts/project-overview-sidebar/project-overview-sidebar-desktop.tsx`
 * - `src/components/menus/desktop-menu-item.tsx` (active rail + emphasis tokens)
 * - `src/app/(main)/(console)/project-overview/layout.tsx` (column split + mobile strip)
 *
 * Nested under `ConsoleShellLayout` (see `@/layouts/console-shell-layout`) for shared `ConsoleHeader`.
 *
 * Nav horizontal inset matches `ConsoleHeader` + `LogoBand`: `mx-5` + `ml-2` → `pl-7`; from `sm` `sm:ml-1` + `ml-2` → `sm:pl-3`.
 */
const items = [
  { to: "/project-overview/environments", label: "Environments", Icon: Boxes },
  { to: "/project-overview/people", label: "People", Icon: Users },
  { to: "/project-overview/repositories", label: "Repositories", Icon: BookMinus },
  { to: "/project-overview/settings", label: "Project Settings", Icon: Settings },
] as const;

function isProjectOverviewPathActive(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function ProjectOverviewNavItem({
  to,
  label,
  Icon,
  onNavigate,
  variant = "desktop",
}: {
  to: string;
  label: string;
  Icon: LucideIcon;
  onNavigate?: () => void;
  variant?: "desktop" | "mobile";
}) {
  const { pathname } = useLocation();
  const isActive = isProjectOverviewPathActive(pathname, to);

  if (variant === "mobile") {
    return (
      <Link
        to={to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-po-nav-inactive transition-colors hover:bg-accent/60 hover:text-foreground",
          isActive && "bg-po-nav-active/10 text-po-nav-active",
        )}
      >
        <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
        {label}
      </Link>
    );
  }

  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "group relative flex h-10 cursor-pointer items-center gap-3 py-1.5 pl-0 pr-4 text-base text-po-nav-inactive transition-colors hover:text-foreground",
        isActive && "!text-po-nav-active",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      <span>{label}</span>
      {isActive ? (
        <div className="absolute right-0 top-2.5 h-5 w-1 rounded-sm bg-po-nav-rail" aria-hidden />
      ) : null}
    </Link>
  );
}

function ProjectOverviewSidebarMobile() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" type="button" className="md:hidden" aria-label="Open project overview menu">
          <MenuIcon className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full p-0" hideClose aria-describedby={undefined}>
        <SheetHeader className="flex h-[60px] flex-row items-center justify-between gap-3 border-b border-border px-4 py-3">
          <SheetTitle className="text-left text-base font-semibold">Project Overview</SheetTitle>
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Close menu">
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <Separator />
        <nav className="grid gap-2 p-4">
          {items.map(({ to, label, Icon }) => (
            <ProjectOverviewNavItem
              key={to}
              to={to}
              label={label}
              Icon={Icon}
              variant="mobile"
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function ProjectOverviewSidebarDesktop() {
  return (
    <aside className="z-10 hidden h-full min-h-0 w-[240px] shrink-0 flex-col self-stretch border-r border-po-sidebar-border bg-sidebar-nav md:flex">
      <nav className="grid w-full shrink-0 items-start gap-1 pl-7 pt-3 text-sm sm:pl-3">
        {items.map(({ to, label, Icon }) => (
          <ProjectOverviewNavItem key={to} to={to} label={label} Icon={Icon} />
        ))}
      </nav>
      {/* Fills remaining column height so the pale sidebar background reads full-height like the reference. */}
      <div className="min-h-0 flex-1" aria-hidden />
    </aside>
  );
}

export function ProjectOverviewShellLayout() {
  return (
    <ProtectedRoute>
      <DashboardGuard>
        {/* Parity: `src/app/(main)/(console)/project-overview/layout.tsx` — main column scrolls with overflow-auto + min-w-0. */}
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
          <ProjectOverviewSidebarDesktop />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-3 md:hidden">
              <ProjectOverviewSidebarMobile />
              <span className="text-sm font-medium">Project Overview</span>
            </div>
            <div className="thin-scrollbar min-h-0 min-w-0 flex-1 overflow-auto overscroll-y-contain bg-surface-app">
              <Outlet />
            </div>
          </div>
        </div>
      </DashboardGuard>
    </ProtectedRoute>
  );
}
