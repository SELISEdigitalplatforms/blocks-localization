import { useState, Fragment, useEffect } from "react";
import { Link } from "react-router-dom";
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
import { ChevronDown, Menu, X } from "lucide-react";
import { LogoBand } from "@/layouts/shell/components/logo-band";
import { ConsoleProjectListDropdown } from "@/features/console/components/console-project-list-dropdown";
import { dashboardNavigationMenus } from "@/layouts/shell/navigation/dashboard-navigation-menus";
import type { DashboardNavMenu } from "@/layouts/shell/navigation/dashboard-navigation-menus";
import { cn } from "@/platform/ui/lib/cn";
import { NavLink, useLocation } from "react-router-dom";
import { Badge } from "@/platform/ui/components/badge/badge";

type MenuItem = Extract<DashboardNavMenu, { type: "menu" }>;

function MobileNavLeaf({ item, depth, onNavigate }: { item: MenuItem; depth: number; onNavigate: () => void }) {
  const { pathname } = useLocation();
  const to = item.path;
  const active = pathname === to || pathname.startsWith(`${to}/`);
  if (item.disabled) return null;

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      style={{ paddingLeft: `${12 + depth * 12}px` }}
      className={cn(
        "flex min-h-10 items-center gap-2 py-2 pr-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
        active && "bg-accent/30 text-primary",
      )}
    >
      {item.icon ? <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} /> : null}
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      {item.badge ? (
        <Badge variant="secondary" className="shrink-0 text-[9px] uppercase">
          {item.badge}
        </Badge>
      ) : null}
    </NavLink>
  );
}

function MobileNavBranch({ item, depth, onNavigate }: { item: MenuItem; depth: number; onNavigate: () => void }) {
  const { pathname } = useLocation();
  const enabled = item.children?.filter((c): c is MenuItem => c.type === "menu" && !c.disabled) ?? [];
  const childPaths: string[] = [];
  function collect(m: MenuItem) {
    childPaths.push(m.path);
    m.children?.forEach((c) => {
      if (c.type === "menu" && !c.disabled) collect(c);
    });
  }
  enabled.forEach(collect);
  const branchActive =
    pathname === item.path ||
    pathname.startsWith(`${item.path}/`) ||
    childPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const [open, setOpen] = useState(branchActive);

  useEffect(() => {
    if (branchActive) setOpen(true);
  }, [branchActive]);

  if (item.disabled) return null;

  if (!enabled.length) {
    return <MobileNavLeaf item={item} depth={depth} onNavigate={onNavigate} />;
  }

  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        type="button"
        className={cn(
          "flex w-full min-h-10 items-center gap-2 py-2 pr-3 text-left text-sm font-medium text-muted-foreground hover:bg-accent/40",
          branchActive && "text-primary",
        )}
        style={{ paddingLeft: `${12 + depth * 12}px` }}
        onClick={() => setOpen((o) => !o)}
      >
        {item.icon ? <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} /> : null}
        <span className="min-w-0 flex-1 truncate">{item.name}</span>
        {item.badge ? (
          <Badge variant="outline" className="shrink-0 text-[9px] uppercase">
            {item.badge}
          </Badge>
        ) : null}
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="pb-1">
          {enabled.map((child) =>
            child.children?.filter((c): c is MenuItem => c.type === "menu" && !c.disabled).length ? (
              <MobileNavBranch key={child.id} item={child} depth={depth + 1} onNavigate={onNavigate} />
            ) : (
              <MobileNavLeaf key={child.id} item={child} depth={depth + 1} onNavigate={onNavigate} />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

export function DashboardSidebarMobile() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" type="button" className="shrink-0 md:hidden" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="thin-scrollbar w-full max-w-sm overflow-y-auto p-0" hideClose aria-describedby={undefined}>
        <SheetHeader className="flex h-[60px] flex-row items-center justify-between gap-3 border-b border-border px-4 py-3 text-left">
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <Link to="/console" onClick={() => setSheetOpen(false)} className="inline-flex min-w-0 flex-1">
            <LogoBand variant="wordmark" className="!ml-0 min-w-0 border-0" />
          </Link>
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Close menu">
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </SheetHeader>

        <div className="space-y-3 px-4 py-4">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Project</div>
            <ConsoleProjectListDropdown />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Environment</div>
            <p className="text-xs text-muted-foreground">Switch environments from the desktop header when available.</p>
          </div>
        </div>

        <Separator />

        <nav className="grid gap-0 py-2">
          {dashboardNavigationMenus.map((entry) => (
            <Fragment key={entry.id}>
              {entry.type === "menu" ? (
                entry.children?.filter((c): c is MenuItem => c.type === "menu" && !c.disabled).length ? (
                  <MobileNavBranch item={entry} depth={0} onNavigate={() => setSheetOpen(false)} />
                ) : (
                  <MobileNavLeaf item={entry} depth={0} onNavigate={() => setSheetOpen(false)} />
                )
              ) : (
                <Separator className="my-2" />
              )}
            </Fragment>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
