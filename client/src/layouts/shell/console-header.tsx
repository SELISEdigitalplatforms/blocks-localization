import { ConsoleProjectListDropdown } from "@/features/console/components/console-project-list-dropdown";
import { Button } from "@/platform/ui/components/button/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/platform/ui/components/sheet/sheet";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BackToConsoleLink } from "@/layouts/shell/components/back-to-console-link";
import { LogoBand } from "@/layouts/shell/components/logo-band";
import { NotificationBellStub } from "@/layouts/shell/components/notification-bell-stub";
import { ShellLanguageSelector } from "@/layouts/shell/components/shell-language-selector";
import { ShellModeToggle } from "@/layouts/shell/components/shell-mode-toggle";
import { ShellUserMenu } from "@/layouts/shell/components/shell-user-menu";
import { useIsMobile } from "@/layouts/shell/hooks/use-is-mobile";

/**
 * Parity target: `src/layouts/console-header/console-header.tsx` (Next).
 * Project overview: bar uses `bg-sidebar-nav` so the header matches the left rail (see `project-overview-shell-layout`).
 */
export function ConsoleHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const isMobile = useIsMobile();
  const path = useLocation().pathname;

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 25);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isConsoleButtonVisible = path === "/profile" || path.startsWith("/project-overview");
  const showCreateProjectBack = path === "/create-project";
  const isProjectListVisible = path.startsWith("/project-overview");
  const showChromeExtras = isConsoleButtonVisible || showCreateProjectBack;
  const headerBar = isScrolled || showChromeExtras;
  const projectOverviewChrome = isProjectListVisible && headerBar;

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-40 ${
        headerBar
          ? projectOverviewChrome
            ? "border-b border-po-sidebar-border bg-sidebar-nav"
            : "border-b border-border bg-background"
          : "bg-transparent"
      }`}
    >
      <header
        className={`mx-5 flex h-12 items-center gap-4 ${showChromeExtras ? "sm:ml-1 sm:mr-6" : "sm:mx-10"} lg:h-[59px]`}
      >
        <div className={`flex h-full min-w-0 flex-1 flex-row items-center ${isMobile ? "mx-0" : ""}`}>
          <LogoBand showRightBorder={isProjectListVisible} />
          {isProjectListVisible ? (
            <div className="ml-4 hidden w-52 sm:block">
              <ConsoleProjectListDropdown />
            </div>
          ) : null}
        </div>

        {isMobile ? (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" type="button" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              hideClose
              side="top"
              className={`thin-scrollbar flex max-h-[min(90dvh,100vh)] min-h-0 w-full flex-wrap items-start gap-3 overflow-y-auto overscroll-y-contain p-4 sm:p-6 ${showChromeExtras ? "justify-between" : "justify-end"}`}
            >
              <div className="flex w-full justify-end">
                <SheetClose asChild>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 -mt-1" aria-label="Close menu">
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>
              {showCreateProjectBack ? (
                <div className="min-w-fit flex-shrink">
                  <BackToConsoleLink />
                </div>
              ) : null}
              {isConsoleButtonVisible ? (
                <div className="min-w-fit flex-shrink">
                  <BackToConsoleLink />
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                {isProjectListVisible ? (
                  <div className="w-full border-b border-border pb-3">
                    <ConsoleProjectListDropdown />
                  </div>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
                  <ShellModeToggle />
                  <NotificationBellStub />
                  <ShellLanguageSelector />
                  <ShellUserMenu />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        ) : null}

        <div className="hidden sm:flex sm:items-center sm:gap-4">
          {showCreateProjectBack ? <BackToConsoleLink /> : null}
          {isConsoleButtonVisible ? <BackToConsoleLink /> : null}
          <ShellModeToggle />
          <NotificationBellStub />
          <ShellLanguageSelector />
          <ShellUserMenu />
        </div>
      </header>
    </div>
  );
}
