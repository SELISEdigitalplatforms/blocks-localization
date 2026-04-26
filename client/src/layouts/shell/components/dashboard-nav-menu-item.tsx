import { Badge } from "@/platform/ui/components/badge/badge";
import { cn } from "@/platform/ui/lib/cn";
import type { DashboardNavMenu } from "@/layouts/shell/navigation/dashboard-navigation-menus";
import { ChevronRight } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

type MenuItem = Extract<DashboardNavMenu, { type: "menu" }>;

function usePathActive(prefix: string, extraPrefixes: string[]) {
  const { pathname } = useLocation();
  const all = [prefix, ...extraPrefixes];
  return all.some((p) => {
    const n = p.replace(/^\//, "");
    return pathname === `/${n}` || pathname === n || pathname.startsWith(`/${n}/`) || pathname.startsWith(`${n}/`);
  });
}

function collectChildPaths(menu: MenuItem): string[] {
  const paths: string[] = [];
  function walk(m: MenuItem) {
    paths.push(m.path);
    m.children?.forEach((c) => {
      if (c.type === "menu" && !c.disabled) walk(c);
    });
  }
  if (menu.children) {
    for (const c of menu.children) {
      if (c.type === "menu" && !c.disabled) walk(c);
    }
  }
  return paths;
}

function ChildLinks({ items }: { items: MenuItem[] }) {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col py-1">
      {items.map((item) => {
        if (item.disabled) return null;
        const nested = item.children?.filter((c): c is MenuItem => c.type === "menu" && !c.disabled) ?? [];

        if (nested.length === 0) {
          const to = item.path;
          const active = pathname === to || pathname.startsWith(`${to}/`) || pathname === to.replace(/^\//, "");
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={cn(
                "flex min-h-10 items-center px-4 py-2 text-sm transition-colors hover:bg-accent/60 hover:text-foreground",
                active && "bg-accent/40 text-primary",
              )}
            >
              <span className="truncate">{item.name}</span>
            </NavLink>
          );
        }

        return (
          <div key={item.id} className="border-b border-border/60 last:border-0">
            <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.name}</div>
            <div className="border-t border-border/40 bg-muted/20 pb-1">
              {nested.map((sub) => {
                const subActive =
                  pathname === sub.path ||
                  pathname.startsWith(`${sub.path}/`) ||
                  pathname === sub.path.replace(/^\//, "");
                return (
                  <NavLink
                    key={sub.id}
                    to={sub.path}
                    className={cn(
                      "flex min-h-9 items-center px-4 py-1.5 text-sm transition-colors hover:text-primary",
                      subActive && "font-medium text-primary",
                    )}
                  >
                    {sub.name}
                  </NavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardNavMenuItem({ menu, isSidebarOpen }: { menu: MenuItem; isSidebarOpen: boolean }) {
  const childPaths = menu.children ? collectChildPaths(menu) : [];
  const isActiveMenu = usePathActive(menu.path, childPaths);
  const hasChildren = Boolean(menu.children?.length);
  const enabledChildren =
    menu.children?.filter((c): c is MenuItem => c.type === "menu" && !c.disabled) ?? [];

  const baseClasses = cn(
    "group relative flex h-10 min-w-0 cursor-default py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
    isSidebarOpen ? "items-center gap-3 px-3" : "items-center justify-center px-0",
    isActiveMenu && "text-primary",
  );

  if (!hasChildren) {
    return (
      <div className={cn(baseClasses, "min-w-0")}>
        <NavLink
          to={menu.path}
          title={!isSidebarOpen ? menu.name : undefined}
          className={cn(
            "flex h-10 w-full min-w-0 items-center rounded-md py-1.5",
            isSidebarOpen ? "gap-3 px-3" : "justify-center px-0",
            menu.disabled && "pointer-events-none opacity-50",
          )}
        >
          {menu.icon ? <menu.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} /> : null}
          {isSidebarOpen ? (
            <span className="relative min-w-0 truncate">
              {menu.name}
              {menu.badge ? (
                <Badge variant="secondary" className="ml-2 align-middle text-[9px] font-semibold uppercase">
                  {menu.badge}
                </Badge>
              ) : null}
            </span>
          ) : null}
        </NavLink>
        {isActiveMenu ? <div className="absolute right-0 top-2.5 h-5 w-1 rounded-sm bg-primary" aria-hidden /> : null}
      </div>
    );
  }

  return (
    <div className={cn(baseClasses, "items-stretch")} title={!isSidebarOpen ? menu.name : undefined}>
      <div className={cn("flex min-w-0 flex-1 items-center", isSidebarOpen ? "gap-3" : "justify-center")}>
        {menu.icon ? <menu.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} /> : null}
        {isSidebarOpen ? (
          <span className="relative min-w-0 truncate">
            {menu.name}
            {menu.badge ? (
              <Badge variant="outline" className="ml-2 align-middle text-[9px] font-semibold uppercase">
                {menu.badge}
              </Badge>
            ) : null}
          </span>
        ) : null}
        {isSidebarOpen ? <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-60" aria-hidden /> : null}
      </div>
      {isActiveMenu ? <div className="absolute right-0 top-2.5 h-5 w-1 rounded-sm bg-primary" aria-hidden /> : null}

      {isSidebarOpen ? (
        <div
          className={cn(
            "invisible absolute left-full top-0 z-30 ml-0 min-w-[13rem] max-w-[min(20rem,calc(100vw-5rem))] flex-col rounded-md border bg-popover py-1 text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100",
            "pointer-events-none group-hover:pointer-events-auto",
          )}
        >
          <ChildLinks items={enabledChildren} />
          <div className="absolute -left-3 top-0 h-full w-3" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}
