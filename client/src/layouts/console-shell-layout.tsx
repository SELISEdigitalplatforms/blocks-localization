import { ConsoleHeader } from "@/layouts/shell/console-header";
import { Outlet } from "react-router-dom";

/**
 * Console routes share a fixed header. Use a single `min-h-dvh` flex column so the content
 * area fills the viewport without stacking a second `min-h-screen` under the header padding
 * (which caused a spurious scrollbar that disappeared when Radix dropdown scroll-lock ran).
 *
 * Parity: `src/app/(main)/(console)/layout.tsx` + `src/layouts/console-header/console-header.tsx`.
 */
export function ConsoleShellLayout() {
  return (
    <div className="relative flex h-dvh w-full min-h-0 flex-col overflow-hidden bg-surface-app">
      <ConsoleHeader />
      <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden pt-12 lg:pt-[59px]">
        <Outlet />
      </div>
    </div>
  );
}
