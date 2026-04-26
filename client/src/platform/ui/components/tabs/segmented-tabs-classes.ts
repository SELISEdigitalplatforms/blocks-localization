/**
 * UILM-only helpers merged after `npm run sync:ui` (see `sync-preserves/`).
 * Not present in monolith `ui-kits/tabs`.
 */
export const segmentedTabsListClass =
  "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground";

export const segmentedTabsTriggerClass =
  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm";
