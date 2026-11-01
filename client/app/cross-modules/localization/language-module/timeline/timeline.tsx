/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from "react";
import useIsMobile from "@/hooks/use-is-mobile";
import { EllipsisVertical, RotateCcw } from "lucide-react";
import { TimelineEvents, IBlocksLanguageKey } from "@blocks-localization/models/language";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { useRevertKeyTimeline } from "@blocks-localization/hooks/use-language-manager";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";

const MODULE = "localization.tools";

/* eslint-disable no-unused-vars */
export interface TimelineProps {
  events: TimelineEvents[];
  leftContent?: (event: TimelineEvents) => React.ReactNode;
  rightContent?: (event: TimelineEvents) => React.ReactNode;
}

// ✅ Normalize to array so flatMap is always safe
const asArray = <T,>(x?: T | T[]): T[] => (Array.isArray(x) ? x : x ? [x] : []);

// ✅ Cultures from both sides
const getCultures = (
  prev?: IBlocksLanguageKey | IBlocksLanguageKey[],
  curr?: IBlocksLanguageKey | IBlocksLanguageKey[],
) => {
  const prevCultures = asArray(prev).flatMap((d) => d.resources?.map((r) => r.culture) ?? []);
  const currCultures = asArray(curr).flatMap((d) => d.resources?.map((r) => r.culture) ?? []);
  return Array.from(new Set([...prevCultures, ...currCultures]));
};

const canRevert = (event: TimelineEvents) =>
  !!event.previousData && event.logFrom !== "KeyController.BulkMove";

const Timeline = (props: TimelineProps) => {
  const { t } = useT(MODULE);
  const isMobile = useIsMobile();
  const projectKey = useProjectStore()?.selectedProject?.tenantId || "";
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvents | null>(null);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false);
  const [selectedRevertEvent, setSelectedRevertEvent] = useState<TimelineEvents | null>(null);

  const { isPending: isRevertPending, mutateAsync: rollbackUilmKey } = useRevertKeyTimeline();

  const handleRevert = async (row: TimelineEvents) => {
    const payload = {
      itemId: row.id,
      projectKey: projectKey,
    };

    const res = await rollbackUilmKey(payload);

    if (!res.isSuccess) {
      showErrorToast({ errors: res.errors });
      return false;
    }

    showSuccessToast({ description: t("TIMELINE.REVERTED") });
    return true;
  };

  const openRevertConfirmation = (event: TimelineEvents) => {
    setSelectedRevertEvent(event);
    // Delay opening to avoid focus conflicts with dropdown closing
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
        {props.events.map((event, index) => (
          <div
            key={index}
            role="button"
            tabIndex={0}
            className="flex min-h-[66px] w-full cursor-pointer"
            onClick={() => setSelectedEvent(event)} // row click => modal
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedEvent(event);
              }
            }}
          >
            <div className={`${isMobile ? `w-[30%]` : `w-[16%]`} relative`}>
              <div className="absolute top-[-6px] w-full pr-[6px] text-right md:pr-[8px] lg:pr-[10px] xl:pr-[18px]">
                {props.leftContent ? (
                  props.leftContent(event)
                ) : (
                  <>
                    <p className="text-[10px] font-medium leading-[16px] text-medium-emphasis xl:text-[12px] xl:leading-[20px]">
                      {event.time}
                    </p>
                    <p className="text-[10px] font-medium leading-[16px] text-medium-emphasis xl:text-[12px] xl:leading-[20px]">
                      {event.date}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="relative">
              {index !== props.events.length - 1 && (
                <div className="absolute left-[37%] h-full w-[4px] bg-[#D9D9D9]" />
              )}
              <div className="relative z-10 h-[16px] w-[16px] rounded-full bg-primary" />
            </div>

            <div className="relative w-full">
              <div className="absolute top-[-6px] w-full pl-[18px] md:pl-[20px]">
                <div className="flex w-full">
                  {props.rightContent ? (
                    props.rightContent(event)
                  ) : (
                    <div className="relative flex w-full flex-row justify-between">
                      <p className="w-[75%] text-[12px] font-medium leading-[20px] text-medium-emphasis md:w-[55%] md:text-[16px] md:leading-[24px]">
                        {event.description}
                      </p>

                      {isMobile && canRevert(event) ? (
                        <div className="flex w-[25%] justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" className="h-5 w-5 p-0">
                                <EllipsisVertical width={20} height={20} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRevertConfirmation(event);
                                }}
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span className="ml-[8px]">{t("TIMELINE.REVERT")}</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : (
                        <div className="flex w-[45%] justify-end">
                          {canRevert(event) && (
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
                                {t("TIMELINE.REVERT")}
                              </span>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
            <DialogTitle>{t("TIMELINE.DIFFERENCE_TITLE")}</DialogTitle>
          </DialogHeader>

          {selectedEvent &&
            (selectedEvent.logFrom === "Published" &&
            !selectedEvent.currentData &&
            !selectedEvent.previousData ? (
              <p className="py-4 text-sm text-muted-foreground">
                {t("TIMELINE.NO_CHANGES_PUBLISHED")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("TIMELINE.COLUMN_LANGUAGE")}</TableHead>
                    <TableHead>{t("TIMELINE.COLUMN_PREVIOUS")}</TableHead>
                    <TableHead>{t("TIMELINE.COLUMN_CURRENT")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getCultures(
                    selectedEvent.previousData as any,
                    selectedEvent.currentData as any,
                  ).map((culture) => {
                    const prevValue =
                      asArray(selectedEvent.previousData as any)
                        .flatMap((d: IBlocksLanguageKey) => d.resources ?? [])
                        .find((r) => r.culture === culture)?.value ?? "-";

                    const currValue =
                      asArray(selectedEvent.currentData as any)
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
        {selectedRevertEvent && (
          <ConfirmationModal
            onCancel={() => {}}
            onConfirm={onConfirmRevert}
            data={{
              dialogTitle: t("TIMELINE.CONFIRM_TITLE"),
              dialogSubtitle: t("TIMELINE.CONFIRM_REVERT"),
              confirmButton: t("TIMELINE.REVERT"),
              cancelButton: t("common:CANCEL"),
            }}
            buttonState={{ confirm: { disable: isRevertPending } }}
          />
        )}
      </Dialog>
    </>
  );
};

export default Timeline;
