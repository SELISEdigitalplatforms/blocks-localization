import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { Plus, Pencil, Tag, EllipsisVertical } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import NewModule from "@blocks-localization/components/modals/new-module/new-module";
import EditModule from "@blocks-localization/components/modals/edit-module/edit-module";
import TagGlossaryModal from "@blocks-localization/components/modals/tag-glossary-modal/tag-glossary-modal";
// TODO: Enable delete module feature — import DeleteModuleModal when backend is ready
// import DeleteModuleModal from "@blocks-localization/components/modals/delete-module-modal/delete-module-modal";
import { useGetLanguageModules } from "@blocks-localization/hooks/use-language-manager";
import { IModuleGets } from "@blocks-localization/models/language";
import { FilterControls } from "@/components/filter-toolbar";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { userLookupService } from "@blocks-localization/services/user-lookup.service";
import { useCurrentUser } from "@blocks-localization/hooks/use-user-lookup";

const compareStrings = (a: string, b: string): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

const getDisplayNamePart = (
  value: string | null | undefined,
): string | null => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
};

const getUserDisplayNameFromUser = (
  user: { firstName: string | null; lastName: string | null; email: string | null; userName: string | null } | null | undefined,
): string => {
  if (!user) return "—";

  const firstName = getDisplayNamePart(user.firstName);
  const lastName = getDisplayNamePart(user.lastName);
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : null;

  return fullName ?? getDisplayNamePart(user.email) ?? getDisplayNamePart(user.userName) ?? "—";
};

function renderModuleRows(
  modules: IModuleGets[],
  getUserDisplayNameById: (userId: string | null) => string,
  scoped: (path: string) => string,
  navigate: (path: string) => void,
  searchText: string,
  onEditModule: (module: IModuleGets) => void,
  onTagGlossaryModule: (module: IModuleGets) => void,
) {
  if (modules.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="h-24 text-center">
          {searchText ? "No modules match your search." : "No modules found. Create your first module to get started."}
        </TableCell>
      </TableRow>
    );
  }

  return modules.map((module) => (
    <TableRow
      key={module.itemId}
      isHoverable
      className="font-normal text-medium-emphasis"
      onClick={() => navigate(scoped(`services/modules/${module.itemId}`))}
    >
      <TableCell className="truncate font-medium">{module.moduleName}</TableCell>
      <TableCell className="truncate">
        {getUserDisplayNameById(module.createdBy)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {module.createDate ? new Date(module.createDate).toLocaleDateString() : "—"}
      </TableCell>
      <TableCell className="text-center">
        <RowActionsCell
          onEdit={() => onEditModule(module)}
          onTagGlossary={() => onTagGlossaryModule(module)}
        />
      </TableCell>
    </TableRow>
  ));
}

// Memoized RowActionsCell component to avoid unnecessary re-renders
const RowActionsCell = ({
  onEdit,
  onTagGlossary,
  // onDelete: () => void;
}: {
  onEdit: () => void;
  onTagGlossary: () => void;
  // onDelete: () => void;
}) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <EllipsisVertical width={20} height={20} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          onEdit();
        }}
      >
        <Pencil className="mr-2 h-4 w-4" />
        <span>Edit</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          onTagGlossary();
        }}
      >
        <Tag className="mr-2 h-4 w-4" />
        <span>Tag glossary</span>
      </DropdownMenuItem>
      {/* TODO: Enable delete module feature — restore this item when backend is ready */}
      {/* <DropdownMenuItem className="cursor-pointer text-error" onClick={onDelete}>
        <Trash className="mr-2 h-4 w-4" />
        <span>Delete</span>
      </DropdownMenuItem> */}
    </DropdownMenuContent>
  </DropdownMenu>
);

export function ModuleTable() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { isLoading: isModulesLoading, data: modulesData, refetch } = useGetLanguageModules();
  const { data: currentUser } = useCurrentUser();
  const [isNewModuleDialogOpen, setIsNewModuleDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IModuleGets | null>(null);
  const [tagTarget, setTagTarget] = useState<IModuleGets | null>(null);
  // TODO: Enable delete module feature — restore this state when backend is ready
  // const [deleteTarget, setDeleteTarget] = useState<IModuleGets | null>(null);

  // Extract unique createdBy user IDs from modules
  const uniqueCreatedByIds = useMemo(() => {
    if (!modulesData) return [];
    const ids = new Set<string>();
    modulesData.forEach((module) => {
      if (module.createdBy) {
        ids.add(module.createdBy);
      }
    });
    return Array.from(ids);
  }, [modulesData]);

  const { data: userMap, isLoading: isUsersLoading } = useQuery({
    queryKey: [
      "module-users",
      [...uniqueCreatedByIds].sort(compareStrings),
    ],
    queryFn: async () => {
      return userLookupService.getUsersByIds(uniqueCreatedByIds);
    },
    enabled: uniqueCreatedByIds.length > 0,
    staleTime: Infinity,
  });

  // Helper function to get user display name
  const getUserDisplayNameById = (userId: string | null): string => {
    if (isUsersLoading) return "—";
    const user = userId ? userMap?.[userId] : currentUser;
    const resolvedUser = user ?? (currentUser?.itemId === userId ? currentUser : undefined);
    return getUserDisplayNameFromUser(resolvedUser);
  };

  const [searchValue, setSearchValue] = useState("");

  const filteredModules = useMemo(() => {
    if (!modulesData) return [];
    if (!searchValue.trim()) return modulesData;
    const search = searchValue.toLowerCase();
    return modulesData.filter(
      (module) =>
        module.moduleName.toLowerCase().includes(search) ||
        module.name?.toLowerCase().includes(search),
    );
  }, [modulesData, searchValue]);

  const handleNewModuleClick = () => {
    setIsNewModuleDialogOpen(true);
  };

  return (
    <main className="flex flex-col">
      <div className="flex w-full flex-col">
        <div className="flex w-full justify-between text-high-emphasis">
          <div className="item-center flex gap-2">
            <h3 className="text-2xl font-bold tracking-tight">Modules</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="default"
              variant="default"
              className="bg-primary text-primary-foreground shadow-none"
              onClick={handleNewModuleClick}
            >
              <Plus className="h-5 w-5 lg:mr-2" />
              <span className="sr-only lg:not-sr-only">New Module</span>
            </Button>
          </div>
        </div>

        <Card className="mt-[18px] rounded shadow-none md:mt-[24px]">
          <CardHeader>
            <CardTitle className="text-xl text-high-emphasis">Language Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-4">
              <div className="w-full sm:w-[300px]">
                <FilterControls.SearchInput
                  value={searchValue}
                  onChange={setSearchValue}
                  placeholder="Search modules..."
                  className="h-9 w-full"
                />
              </div>
            </div>
            <div className="w-full overflow-x-auto">
              <Table className="min-w-[720px] table-fixed text-sm lg:min-w-0">
                <TableHeader>
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="w-[220px] font-bold text-medium-emphasis">
                      Module Name
                    </TableHead>
                    <TableHead className="w-[220px] font-bold text-medium-emphasis">
                      Created By
                    </TableHead>
                    <TableHead className="w-[180px] font-bold text-medium-emphasis">
                      Created Date
                    </TableHead>
                    <TableHead className="w-[100px] font-bold text-medium-emphasis">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isModulesLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        {[1, 2, 3, 4].map((_, colIndex) => (
                          <TableCell key={colIndex}>
                            <Skeleton className="h-6 w-full rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    renderModuleRows(
                    filteredModules,
                    getUserDisplayNameById,
                    scoped,
                    navigate,
                    searchValue,
                    setEditTarget,
                    setTagTarget,
                  )
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isNewModuleDialogOpen} onOpenChange={setIsNewModuleDialogOpen}>
          <NewModule
            onClose={() => {
              setIsNewModuleDialogOpen(false);
              refetch().then(() => {
                queryClient.invalidateQueries({
                  queryKey: ["module-users"],
                });
              });
            }}
          />
        </Dialog>

        {/* Edit Module Dialog */}
        <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
          {editTarget && <EditModule module={editTarget} onClose={() => setEditTarget(null)} />}
        </Dialog>

        {/* Tag Glossary Dialog */}
        <Dialog open={!!tagTarget} onOpenChange={(open) => !open && setTagTarget(null)}>
          {tagTarget && <TagGlossaryModal module={tagTarget} onClose={() => setTagTarget(null)} />}
        </Dialog>

        {/* TODO: Enable delete module feature — restore this dialog when backend is ready */}
        {/* <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          {deleteTarget && (
            <DeleteModuleModal
              module={deleteTarget}
              allModules={modulesList}
              onClose={() => setDeleteTarget(null)}
            />
          )}
        </Dialog> */}
      </div>
    </main>
  );
}
