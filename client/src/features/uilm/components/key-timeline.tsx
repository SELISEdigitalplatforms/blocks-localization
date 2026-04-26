import { useState } from "react";
import { Button } from "@/platform/ui/components/button/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/platform/ui/components/dropdown-menu/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/platform/ui/components/table/table";
import { EllipsisVertical, Loader2, RotateCcw } from "lucide-react";
import type { IBlocksLanguageKey, TimelineEvents } from "@/features/uilm/types/language";
import { useUilmRevertKeyTimeline } from "@/features/uilm/hooks/use-uilm-queries";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";

interface KeyTimelineProps {
  events: TimelineEvents[];
}

// Normalize to array so flatMap is always safe
const asArray = <T,>(x?: T | T[]): T[] => (Array.isArray(x) ? x : x ? [x] : []);

// Cultures from both sides
const getCultures = (
  prev?: IBlocksLanguageKey | IBlocksLanguageKey[],
  curr?: IBlocksLanguageKey | IBlocksLanguageKey[],
) => {
  const prevCultures = asArray(prev).flatMap((d) => d.resources?.map((r) => r.culture) ?? []);
  const currCultures = asArray(curr).flatMap((d) => d.resources?.map((r) => r.culture) ?? []);
  return Array.from(new Set([...prevCultures, ...currCultures]));
};

export function KeyTimeline({ events }: KeyTimelineProps) {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvents | null>(null);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false);
  const [selectedRevertEvent, setSelectedRevertEvent] = useState<TimelineEvents | null>(null);

  const { isPending: isRevertPending, mutateAsync: rollbackUilmKey } = useUilmRevertKeyTimeline();

  const handleRevert = async (row: TimelineEvents) => {
    try {
      const res = await rollbackUilmKey({ itemId: row.id });
      if (!res.isSuccess) {
        showErrorToast({ errors: res.errors ?? "Revert failed" });
        return false;
      }
      showSuccessToast({ description: "Timeline reverted successfully!" });
      return true;
    } catch (e) {
      showErrorToast({ errors: e instanceof Error ? e.message : "Revert failed" });
      return false;
    }
  };

  const openRevertConfirmation = (event: TimelineEvents) => {
    setSelectedRevertEvent(event);
    setTimeout(() => setIsRevertDialogOpen(true), 0);
  };

  const onConfirmRevert = async () => {
    if (!selectedRevertEvent) return;
    const ok = await handleRevert(selectedRevertEvent);
    if (ok) {
      setIsRevertDialogOpen(false);
      setSelectedRevertEvent(null);
    }
  };

  return (
    <>
      <div className="mt-[16px] flex flex-col items-start md:mt-[20px]">
        {events.map((event, index) => (
          <div
            key={index}
            className="flex min-h-[66px] w-full cursor-pointer"
            onClick={() => setSelectedEvent(event)}
          >
            <div className="relative w-[16%]">
              <div className="absolute -top-[6px] w-full pr-[6px] text-right md:pr-[8px] lg:pr-[10px] xl:pr-[18px]">
                <p className="text-[10px] font-medium leading-[16px] text-medium-emphasis xl:text-[12px] xl:leading-[20px]">
                  {event.time}
                </p>
                <p className="text-[10px] font-medium leading-[16px] text-medium-emphasis xl:text-[12px] xl:leading-[20px]">
                  {event.date}
                </p>
              </div>
            </div>

            <div className="relative">
              {index !== events.length - 1 && (
                <div className="absolute left-[37%] h-full w-[4px] bg-[#D9D9D9]" />
              )}
              <div className="relative z-10 h-[16px] w-[16px] rounded-full bg-primary" />
            </div>

            <div className="relative w-full">
              <div className="absolute -top-[6px] w-full pl-[18px] md:pl-[20px]">
                <div className="flex w-full">
                  <div className="relative flex w-full flex-row justify-between">
                    <p className="w-[55%] text-[12px] font-medium leading-[20px] text-medium-emphasis md:text-[16px] md:leading-[24px]">
                      {event.description}
                    </p>

                    <div className="hidden w-[45%] justify-end md:flex">
                      {event.previousData && (
                        <Button
                          size="default"
                          variant="outline"
                          className="gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRevertConfirmation(event);
                          }}
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Revert
                          </span>
                        </Button>
                      )}
                    </div>

                    {event.previousData && (
                      <div className="flex w-[25%] justify-end md:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" className="h-5 w-5 p-0">
                              <EllipsisVertical width={20} height={20} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRevertConfirmation(event);
                              }}
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span className="ml-[8px]">Revert</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Differences Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Language Difference</DialogTitle>
          </DialogHeader>

          {selectedEvent &&
            (selectedEvent.logFrom === "Published" &&
            !selectedEvent.currentData &&
            !selectedEvent.previousData ? (
              <p className="py-4 text-sm text-muted-foreground">No changes published.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Language</TableHead>
                    <TableHead>Previous</TableHead>
                    <TableHead>Current</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getCultures(
                    selectedEvent.previousData as unknown as IBlocksLanguageKey,
                    selectedEvent.currentData as unknown as IBlocksLanguageKey,
                  ).map((culture) => {
                    const prevValue =
                      asArray(selectedEvent.previousData as unknown as IBlocksLanguageKey)
                        .flatMap((d: IBlocksLanguageKey) => d.resources ?? [])
                        .find((r) => r.culture === culture)?.value ?? "-";

                    const currValue =
                      asArray(selectedEvent.currentData as unknown as IBlocksLanguageKey)
                        .flatMap((d: IBlocksLanguageKey) => d.resources ?? [])
                        .find((r) => r.culture === culture)?.value ?? "-";

                    return (
                      <TableRow key={culture}>
                        <TableCell>{culture}</TableCell>
                        <TableCell>{prevValue}</TableCell>
                        <TableCell>{currValue}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ))}
        </DialogContent>
      </Dialog>

      {/* Revert Confirmation Modal */}
      <Dialog open={isRevertDialogOpen} onOpenChange={setIsRevertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to revert this change?
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRevertDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isRevertPending}
              onClick={onConfirmRevert}
            >
              {isRevertPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
