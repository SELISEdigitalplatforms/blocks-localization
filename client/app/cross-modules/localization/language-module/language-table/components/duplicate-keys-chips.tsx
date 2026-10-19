import { useEffect } from "react";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { badgeVariants } from "@/components/ui-kits/badge/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";
import { useKeysFilterQueryParams } from "@blocks-localization/components/language-table-toolbar/language-table-toolbar";
import {
  useEnforceUniqueness,
  useGetDuplicateSummary,
} from "@blocks-localization/hooks/use-language-manager";

export const DUPLICATES_TOOLTIP_SUFFIX = "Click to show them.";
export const DUPLICATE_MODULES_TOOLTIP =
  "Some module names are used by more than one module. Keys may be split between them.";

/**
 * sessionStorage flag: uniqueness is requested at most once per tenant per browser session for each
 * collection. The value lists the collections already requested ("keys", "modules"), so keys that
 * become clean later in the session still get their request after modules had theirs.
 */
export const enforceUniquenessFlag = (tenantId: string) => `loc-enforce-uniqueness:${tenantId}`;

type Collection = "keys" | "modules";

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

const readRequested = (key: string): Collection[] => {
  try {
    const value = globalThis.sessionStorage.getItem(key);
    return value
      ? (value.split(",").filter((c) => c === "keys" || c === "modules") as Collection[])
      : [];
  } catch {
    return [];
  }
};

const writeRequested = (key: string, collections: Collection[]) => {
  try {
    globalThis.sessionStorage.setItem(key, collections.join(","));
  } catch {
    // Without storage the request may repeat on a later visit; enforcement is idempotent.
  }
};

/**
 * The duplicate-key chip (toggles the `duplicates` filter) and the duplicate-modules badge in the
 * Translations header. Both stay hidden while the summary loads, if it fails, or when the count is 0.
 */
export function DuplicateKeysChips() {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { queryParams, setQueryParams } = useKeysFilterQueryParams();
  const { data: summary, isError } = useGetDuplicateSummary();
  const { mutate: enforceUniqueness } = useEnforceUniqueness();
  const active = Boolean(queryParams.duplicates);

  // A clean tenant gets duplicate prevention turned on, once per browser session. A refusal
  // (for example 403 for a user without the bulk-delete permission) is ignored silently.
  useEffect(() => {
    if (!summary || !tenantId) return;
    const ready: Collection[] = [];
    if (summary.extraKeyCount === 0 && !summary.keyUniquenessEnforced) ready.push("keys");
    if (summary.extraModuleCount === 0 && !summary.moduleUniquenessEnforced) ready.push("modules");

    const flag = enforceUniquenessFlag(tenantId);
    const requested = readRequested(flag);
    if (!ready.some((collection) => !requested.includes(collection))) return;

    writeRequested(flag, Array.from(new Set([...requested, ...ready])));
    enforceUniqueness(undefined, { onError: () => undefined });
  }, [summary, tenantId, enforceUniqueness]);

  // Once the last duplicate is gone, the filter has nothing left to show.
  useEffect(() => {
    if (active && summary?.extraKeyCount === 0) {
      setQueryParams((prev) => ({ ...prev, duplicates: null, pageNumber: 0 }));
    }
  }, [active, summary, setQueryParams]);

  if (!summary || isError) return null;

  const toggle = () =>
    setQueryParams((prev) => ({ ...prev, duplicates: active ? null : true, pageNumber: 0 }));

  const keyText = plural(summary.extraKeyCount, "duplicate", "duplicates");
  const keyTooltip = `${summary.keyGroupCount.toLocaleString()} keys have more than one row in the same module. ${DUPLICATES_TOOLTIP_SUFFIX}`;
  const moduleText = plural(summary.extraModuleCount, "duplicate module", "duplicate modules");

  return (
    <>
      {summary.extraKeyCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid="duplicate-keys-chip"
              aria-pressed={active}
              aria-label={`${keyText}. ${keyTooltip}`}
              onClick={toggle}
              className={cn(
                badgeVariants({ variant: "warning" }),
                "gap-1.5 rounded-full",
                active && "ring-2 ring-ring",
              )}
            >
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-icon-warning opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-icon-warning" />
              </span>
              {keyText}
            </button>
          </TooltipTrigger>
          <TooltipContent>{keyTooltip}</TooltipContent>
        </Tooltip>
      )}
      {summary.extraModuleCount > 0 && (
        <Tooltip>
          {/* The trigger's own button keeps the tooltip keyboard-reachable; it has no click action. */}
          <TooltipTrigger
            type="button"
            className="inline-flex cursor-default rounded-full"
            aria-label={`${moduleText}. ${DUPLICATE_MODULES_TOOLTIP}`}
          >
            <span
              className={cn(badgeVariants({ variant: "warning" }), "rounded-full")}
              data-testid="duplicate-modules-badge"
            >
              {moduleText}
            </span>
          </TooltipTrigger>
          <TooltipContent>{DUPLICATE_MODULES_TOOLTIP}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
