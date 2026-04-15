import type { ILanguageModule } from "@/features/uilm/types/language";
import { Badge } from "@/platform/ui/components/badge/badge";
import { Button } from "@/platform/ui/components/button/button";
import { Calendar } from "@/platform/ui/components/calendar/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/platform/ui/components/command/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/platform/ui/components/popover/popover";
import { cn } from "@/platform/ui/lib/cn";
import { useIsMobile } from "@/layouts/shell/hooks/use-is-mobile";
import { CalendarIcon, Check, PlusCircle, X } from "lucide-react";
import type { ReactNode } from "react";
import { MouseEvent, useEffect, useState } from "react";

export type DateRangeState = { from?: string; to?: string };

type LanguageTableToolbarProps = {
  modules: ILanguageModule[];
  moduleIds: string[];
  onToggleModule: (moduleId: string, checked: boolean) => void;
  createRange: DateRangeState;
  onCreateRangeChange: (next: DateRangeState) => void;
  lastUpdateRange: DateRangeState;
  onLastUpdateRangeChange: (next: DateRangeState) => void;
  /** Clears modules + create/last-update date filters (monolith “Reset ×”). */
  onResetFilters: () => void;
  /** Right-aligned control (e.g. View menu), matching monolith filter row. */
  trailing?: ReactNode;
};

// ---------------------------------------------------------------------------
// Multi-select modules filter with search (matching Next.js MultiSelect)
// ---------------------------------------------------------------------------

function ModulesMultiSelect({
  modules,
  moduleIds,
  onToggleModule,
}: {
  modules: ILanguageModule[];
  moduleIds: string[];
  onToggleModule: (moduleId: string, checked: boolean) => void;
}) {
  const moduleList = Array.isArray(modules) ? modules : [];
  const options = moduleList.map((m) => ({ label: m.moduleName, value: m.itemId }));

  const onSelectHandler = (value: string) => {
    const isSelected = moduleIds.includes(value);
    onToggleModule(value, !isSelected);
  };

  const onResetHandler = () => {
    // Deselect all
    moduleIds.forEach((id) => onToggleModule(id, false));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="h-9 max-w-[min(100%,320px)] gap-2 px-3 font-normal"
        >
          <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="shrink-0">Modules</span>
          {moduleIds.length > 0 ? (
            <>
              <span className="hidden text-muted-foreground sm:inline" aria-hidden>
                |
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1">
                {moduleIds.length > 2 ? (
                  <Badge variant="secondary" className="max-w-full truncate rounded-sm px-1.5 py-0 text-xs font-normal">
                    {moduleIds.length} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => moduleIds.includes(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="max-w-[140px] truncate rounded-sm px-1.5 py-0 text-xs font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 sm:w-full" align="start">
        <Command>
          <CommandInput placeholder="Modules" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = moduleIds.includes(option.value);
                return (
                  <CommandItem key={option.value} onSelect={() => onSelectHandler(option.value)}>
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {moduleIds.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onResetHandler()}
                    className="justify-center text-center"
                  >
                    Clear
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Date range picker with Calendar (matching Next.js DateRange + logs toolbar DD/MM/YYYY)
// ---------------------------------------------------------------------------

type DateRangeType = { from?: Date; to?: Date } | null;

/** DD/MM/YYYY — same as logs filter summary. */
function formatShortLocalDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function appliedRangeLabel(range: DateRangeState): string | null {
  if (!range.from) return null;
  const from = new Date(range.from);
  const to = range.to ? new Date(range.to) : from;
  return `${formatShortLocalDate(from)} - ${formatShortLocalDate(to)}`;
}

function DateRangeCalendarPopover({
  label,
  range,
  onChange,
}: {
  label: string;
  range: DateRangeState;
  onChange: (next: DateRangeState) => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const dateValue: DateRangeType = {
    from: range.from ? new Date(range.from) : undefined,
    to: range.to ? new Date(range.to) : undefined,
  };
  const [date, setDate] = useState<DateRangeType>(dateValue);

  useEffect(() => {
    if (!open) {
      setDate(dateValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, range.from, range.to]);

  const handleDateSelect = (selectedDateRange: DateRangeType | undefined) => {
    if (!selectedDateRange) return setDate(null);
    setDate(selectedDateRange);
  };

  const resetBtnHandler = (event: MouseEvent) => {
    event.stopPropagation();
    setDate(null);
  };

  const applyBtnHandler = (event: MouseEvent) => {
    event.stopPropagation();
    const end = date?.to ?? date?.from;
    onChange({
      from: date?.from?.toISOString(),
      to: end?.toISOString(),
    });
    setOpen(false);
  };

  const summary = appliedRangeLabel(range);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setDate(dateValue);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="h-9 max-w-[min(100%,400px)] gap-2 px-3 font-normal"
        >
          <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="shrink-0">{label}</span>
          {summary ? (
            <>
              <span className="hidden text-muted-foreground sm:inline" aria-hidden>
                |
              </span>
              <span className="min-w-0 truncate text-left text-xs font-normal text-muted-foreground">
                {summary}
              </span>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date?.from ? { from: date.from, to: date.to } : undefined}
          onSelect={handleDateSelect}
          numberOfMonths={isMobile ? 1 : 2}
        />
        <div className="flex items-center gap-2 border-t border-border px-3 py-3">
          <Button type="button" variant="outline" className="flex-1" size="sm" onClick={resetBtnHandler}>
            Reset
          </Button>
          <Button type="button" className="flex-1" size="sm" onClick={applyBtnHandler}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Main Toolbar
// ---------------------------------------------------------------------------

export function LanguageTableToolbar({
  modules,
  moduleIds,
  onToggleModule,
  createRange,
  onCreateRangeChange,
  lastUpdateRange,
  onLastUpdateRangeChange,
  onResetFilters,
  trailing,
}: LanguageTableToolbarProps) {
  const hasActiveFilters =
    moduleIds.length > 0 ||
    Boolean(createRange.from || createRange.to) ||
    Boolean(lastUpdateRange.from || lastUpdateRange.to);

  return (
    <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <ModulesMultiSelect
          modules={modules}
          moduleIds={moduleIds}
          onToggleModule={onToggleModule}
        />
        <DateRangeCalendarPopover
          label="Create Date"
          range={createRange}
          onChange={onCreateRangeChange}
        />
        <DateRangeCalendarPopover
          label="Last Update Date"
          range={lastUpdateRange}
          onChange={onLastUpdateRangeChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 font-normal"
          disabled={!hasActiveFilters}
          onClick={onResetFilters}
          aria-label="Reset all translation filters"
        >
          Reset
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {trailing ? <div className="flex shrink-0 items-center">{trailing}</div> : null}
    </div>
  );
}
