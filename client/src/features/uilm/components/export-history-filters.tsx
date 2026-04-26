import { Calendar } from "@/platform/ui/components/calendar/calendar";
import { Button } from "@/platform/ui/components/button/button";
import { Input } from "@/platform/ui/components/input/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/platform/ui/components/popover/popover";
import { useIsMobile } from "@/layouts/shell/hooks/use-is-mobile";
import { Calendar as CalendarIcon, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

export type ExportHistoryFilterState = {
  searchText: string;
  startDate: string;
  endDate: string;
};

type DateRangeDraft = { from?: Date; to?: Date } | undefined;

function filterToRangeDraft(f: ExportHistoryFilterState): DateRangeDraft {
  const from = f.startDate ? new Date(f.startDate) : undefined;
  const to = f.endDate ? new Date(f.endDate) : undefined;
  if (!from && !to) return undefined;
  return { from, to };
}

function localDayToStartIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T00:00:00.000Z`;
}

function localDayToEndIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T23:59:59.999Z`;
}

function appliedRangeLabel(f: ExportHistoryFilterState): string | null {
  if (!f.startDate) return null;
  const from = new Date(f.startDate);
  const to = f.endDate ? new Date(f.endDate) : from;
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${fmt(from)} - ${fmt(to)}`;
}

type ExportHistoryFiltersProps = {
  value: ExportHistoryFilterState;
  onChange: (next: ExportHistoryFilterState) => void;
};

export function ExportHistoryFilters({ value, onChange }: ExportHistoryFiltersProps) {
  const isMobile = useIsMobile();
  const [dateOpen, setDateOpen] = useState(false);
  const draftFromFilter = filterToRangeDraft(value);
  const [draftRange, setDraftRange] = useState<DateRangeDraft>(draftFromFilter);

  useEffect(() => {
    if (!dateOpen) {
      setDraftRange(draftFromFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateOpen, value.startDate, value.endDate]);

  const applyDate = () => {
    const from = draftRange?.from;
    const to = draftRange?.to ?? draftRange?.from;
    onChange({
      ...value,
      startDate: from ? localDayToStartIso(from) : "",
      endDate: to ? localDayToEndIso(to) : "",
    });
    setDateOpen(false);
  };

  const resetDate = () => {
    setDraftRange(undefined);
    onChange({ ...value, startDate: "", endDate: "" });
    setDateOpen(false);
  };

  const dateSummary = appliedRangeLabel(value);
  const hasActiveFilters =
    value.searchText.trim().length > 0 || Boolean(value.startDate || value.endDate);

  const resetAll = () => {
    onChange({ searchText: "", startDate: "", endDate: "" });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[min(100%,200px)] max-w-md flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          className="h-9 pl-9"
          value={value.searchText}
          onChange={(e) => onChange({ ...value, searchText: e.target.value })}
        />
        {value.searchText ? (
          <button
            type="button"
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            onClick={() => onChange({ ...value, searchText: "" })}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <Popover
        open={dateOpen}
        onOpenChange={(o) => {
          setDateOpen(o);
          if (o) setDraftRange(filterToRangeDraft(value));
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="h-9 max-w-[min(100%,380px)] gap-2 px-3 font-normal"
          >
            <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="shrink-0">Date</span>
            {dateSummary ? (
              <>
                <span className="hidden text-muted-foreground sm:inline" aria-hidden>
                  |
                </span>
                <span className="min-w-0 truncate text-left text-xs font-normal text-muted-foreground">
                  {dateSummary}
                </span>
              </>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={draftRange?.from ?? draftFromFilter?.from ?? new Date()}
            selected={draftRange?.from ? { from: draftRange.from, to: draftRange.to } : undefined}
            onSelect={(range) => {
              if (!range) return setDraftRange(undefined);
              setDraftRange({ from: range.from, to: range.to });
            }}
            numberOfMonths={isMobile ? 1 : 2}
          />
          <div className="flex items-center gap-2 border-t border-border px-3 py-3">
            <Button type="button" variant="outline" className="flex-1" size="sm" onClick={resetDate}>
              Reset
            </Button>
            <Button type="button" className="flex-1" size="sm" onClick={applyDate}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 font-normal"
        disabled={!hasActiveFilters}
        onClick={resetAll}
        aria-label="Reset export history filters"
      >
        Reset
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
