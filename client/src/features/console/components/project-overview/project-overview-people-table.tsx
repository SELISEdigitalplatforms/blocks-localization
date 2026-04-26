import { environmentOptions } from "@/features/console/constants/environment-options";
import type { PeopleGroupedByEnvironments } from "@/features/console/model/people";
import {
  getBlocksProjectKeyForIam,
  useResendActivationMutation,
  useResendInvitationMutation,
  useTransferOwnershipMutation,
} from "@/features/console/hooks/use-project-overview-mutations";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { Badge } from "@/platform/ui/components/badge/badge";
import { Button } from "@/platform/ui/components/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/platform/ui/components/table/table";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import {
  type CellContext,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowRightLeft, EllipsisVertical, Mail, RefreshCw, User } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  people: PeopleGroupedByEnvironments[];
  isLoading: boolean;
  isViewerOwner?: boolean;
};

function OwnerBadge() {
  return (
    <Badge className="w-fit bg-primary/10 px-2 py-0.5 text-[10px] text-xs font-normal text-primary">
      Owner
    </Badge>
  );
}

function PendingBadge() {
  return (
    <Badge className="w-fit bg-amber-100 px-2 py-0.5 text-[10px] text-xs font-normal text-amber-800 dark:bg-amber-950 dark:text-amber-200">
      Pending Invite
    </Badge>
  );
}

function InactiveBadge() {
  return (
    <Badge className="w-fit bg-red-100 px-2 py-0.5 text-[10px] text-xs font-normal text-red-800 dark:bg-red-950 dark:text-red-200">
      Inactive
    </Badge>
  );
}

export function ProjectOverviewPeopleTable({ people, isLoading, isViewerOwner = false }: Props) {
  const navigate = useNavigate();
  const groupId = useConsoleProjectStore((s) => s.selectedTenantGroup) ?? "";
  const { mutateAsync: resendInvitation } = useResendInvitationMutation();
  const { mutateAsync: resendActivation } = useResendActivationMutation();
  const { mutateAsync: transferOwnership, isPending: isTransferring } = useTransferOwnershipMutation();

  const [resendInviteOpen, setResendInviteOpen] = useState(false);
  const [resendActivationOpen, setResendActivationOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selected, setSelected] = useState<PeopleGroupedByEnvironments | null>(null);

  const blocksKey = getBlocksProjectKeyForIam();

  const columns = useMemo<ColumnDef<PeopleGroupedByEnvironments>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) =>
          `${row.peopleDetails.firstName} ${row.peopleDetails.lastName || ""}`.trim(),
        header: () => (
          <div className="flex min-w-[200px] items-center">
            <span className="font-bold text-medium-emphasis">Name</span>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const fullName =
            `${row.peopleDetails.firstName} ${row.peopleDetails.lastName || ""}`.trim();
          const displayName = fullName || row.peopleDetails.email?.split("@")[0] || "---";
          const url = row.peopleDetails.profileImageUrl;

          return (
            <div className="ml-2 flex items-center gap-3 sm:ml-0">
              <div className="relative h-8 w-8 min-w-8 overflow-hidden rounded-full bg-muted">
                {url ? (
                  <img src={url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
              <span className="truncate">{displayName}</span>
              {row.sharedEnviroments.some((e) => e.isCreator) ? <OwnerBadge /> : null}
              {row.sharedEnviroments.some((e) => !e.isInvitationConfirmed) &&
              !row.sharedEnviroments.some((e) => e.isCreator) ? (
                <PendingBadge />
              ) : null}
              {row.peopleDetails.allowResendActivation ? <InactiveBadge /> : null}
            </div>
          );
        },
      },
      {
        id: "email",
        accessorFn: (row) => row.peopleDetails.email,
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Email</span>
          </div>
        ),
        cell: (info) => (
          <div className="ml-2 max-w-[300px] truncate lowercase sm:ml-0">
            {info.row.original.peopleDetails.email || "-"}
          </div>
        ),
      },
      {
        id: "environments",
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Environments</span>
          </div>
        ),
        cell: ({ row }: CellContext<PeopleGroupedByEnvironments, unknown>) => {
          const { sharedEnviroments } = row.original;
          const total = sharedEnviroments.length;
          const displayed = total > 3 ? sharedEnviroments.slice(0, 2) : sharedEnviroments;
          const hasMore = total > 3;
          const moreCount = total - 2;

          return (
            <div className="ml-2 flex max-w-[240px] flex-wrap gap-1 sm:ml-0">
              {total > 0 ? (
                <>
                  {displayed.map((env) => {
                    const label =
                      environmentOptions.find((o) => o.value === env.enviroment)?.label ||
                      env.enviroment;
                    return (
                      <Badge key={env.itemId} variant="secondary" className="text-xs font-normal">
                        {label}
                      </Badge>
                    );
                  })}
                  {hasMore ? (
                    <Badge variant="secondary" className="text-xs font-normal">
                      +{moreCount}
                    </Badge>
                  ) : null}
                </>
              ) : (
                <span>-</span>
              )}
            </div>
          );
        },
      },
      ...(isViewerOwner
        ? [
            {
              id: "actions",
              cell: ({ row }: CellContext<PeopleGroupedByEnvironments, unknown>) => {
                const isRowOwner = row.original.sharedEnviroments.some((e) => e.isCreator);
                if (isRowOwner) return null;

                const hasPending = row.original.sharedEnviroments.some((e) => !e.isInvitationConfirmed);
                const isOwnerFlag = row.original.sharedEnviroments.some((e) => e.isCreator);
                const showResendInvite = hasPending && !isOwnerFlag;
                const showResendActivation = row.original.peopleDetails.allowResendActivation;

                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="sr-only">Open menu</span>
                        <EllipsisVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {showResendInvite ? (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(row.original);
                            setResendInviteOpen(true);
                          }}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Resend Invitation
                        </DropdownMenuItem>
                      ) : null}
                      {showResendActivation ? (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(row.original);
                            setResendActivationOpen(true);
                          }}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Resend Activation
                        </DropdownMenuItem>
                      ) : null}
                      {!showResendActivation && !showResendInvite ? (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(row.original);
                            setTransferOpen(true);
                          }}
                        >
                          <ArrowRightLeft className="mr-2 h-4 w-4" />
                          Transfer Ownership
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              },
            } satisfies ColumnDef<PeopleGroupedByEnvironments>,
          ]
        : []),
    ],
    [isViewerOwner],
  );

  const table = useReactTable({
    data: people,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const confirmResendInvite = async () => {
    if (!selected) return;
    try {
      await resendInvitation({ email: selected.peopleDetails.email, groupId });
      showSuccessToast({ description: "Resend invitation mail successfully" });
      setResendInviteOpen(false);
    } catch (e) {
      showErrorToast({ errors: e instanceof Error ? e.message : String(e) });
    }
  };

  const confirmResendActivation = async () => {
    if (!selected || !blocksKey) {
      showErrorToast({ errors: "Missing X-Blocks-Key for activation resend" });
      return;
    }
    try {
      await resendActivation({
        userId: selected.peopleDetails.userId,
        projectKey: blocksKey,
      });
      showSuccessToast({ description: "Resend activation mail successfully" });
      setResendActivationOpen(false);
    } catch (e) {
      showErrorToast({ errors: e instanceof Error ? e.message : String(e) });
    }
  };

  const confirmTransfer = async () => {
    if (!selected) return;
    try {
      await transferOwnership({
        tenantGroupId: groupId,
        transferToUserEmail: selected.peopleDetails.email,
      });
      showSuccessToast({ description: "Ownership transferred successfully" });
      setTransferOpen(false);
    } catch (e) {
      showErrorToast({ errors: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {columns.map((_, colIndex) => (
                    <TableCell key={colIndex}>
                      <Skeleton className="h-6 w-full rounded-sm" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : !people.length
              ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                      No results found.
                    </TableCell>
                  </TableRow>
                )
              : table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/project-overview/people/${row.original.peopleDetails.userId}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} onClick={(e) => cell.column.id === "actions" && e.stopPropagation()}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
        </TableBody>
      </Table>

      <Dialog open={resendInviteOpen} onOpenChange={setResendInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to resend the invitation to {selected?.peopleDetails.email}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResendInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmResendInvite()}>
              Resend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resendActivationOpen} onOpenChange={setResendActivationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend Activation</DialogTitle>
            <DialogDescription>
              Are you sure you want to resend the activation mail to {selected?.peopleDetails.email}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResendActivationOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmResendActivation()}>
              Resend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
            <DialogDescription>
              Are you sure you want to transfer ownership to {selected?.peopleDetails.email}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTransferOpen(false)} disabled={isTransferring}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmTransfer()} disabled={isTransferring}>
              {isTransferring ? "Transferring…" : "Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
