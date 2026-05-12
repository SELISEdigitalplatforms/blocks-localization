import { Button } from "@/components/ui-kits/button/button";
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
import { useGetLanguageModules } from "@blocks-localization/hooks/use-language-manager";
import { FilterControls } from "@/components/filter-toolbar";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash, EllipsisVertical } from "lucide-react";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@/store/useProjectStore";
import { userService } from "@blocks-idp/iam/services/user.service";
import { useQuery } from "@tanstack/react-query";

// Memoized RowActionsCell component to avoid unnecessary re-renders
const RowActionsCell = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="h-8 w-8 p-0">
        <EllipsisVertical width={20} height={20} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
        <Pencil className="mr-2 h-4 w-4" />
        <span>Edit</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer text-medium-emphasis"
        onClick={onDelete}
      >
        <Trash className="mr-2 h-4 w-4" />
        <span>Delete</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export function ModuleTable() {
  const { isLoading: isModulesLoading, data: modulesData, refetch } = useGetLanguageModules();
  const [isNewModuleDialogOpen, setIsNewModuleDialogOpen] = useState(false);
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

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

  // Fetch users by IDs using useQuery
  const { data: userMap, isLoading: isUsersLoading } = useQuery({
    queryKey: ["module-users", tenantId, uniqueCreatedByIds.sort()],
    queryFn: async () => {
      if (uniqueCreatedByIds.length === 0) return {};

      const map: Record<string, { firstName: string; lastName: string; email: string; userName: string }> = {};

      // Fetch all users in parallel
      const promises = uniqueCreatedByIds.map(async (userId) => {
        try {
          const response = await userService.getUserById({ id: userId, projectKey: tenantId });
          if (response?.data) {
            map[userId] = {
              firstName: response.data.firstName,
              lastName: response.data.lastName,
              email: response.data.email,
              userName: response.data.userName,
            };
          }
        } catch (error) {
          console.error(`Failed to fetch user ${userId}:`, error);
        }
      });

      await Promise.all(promises);
      return map;
    },
    enabled: !!tenantId && uniqueCreatedByIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Helper function to get user display name
  const getUserDisplayName = (userId: string | null): string => {
    if (!userId) return "—";
    // If user data is still loading, show placeholder
    if (isUsersLoading || !userMap) {
      return "—";
    }
    const user = userMap[userId];
    if (user) {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      return fullName || user.email || user.userName || userId;
    }
    return userId;
  };

  const [searchValue, setSearchValue] = useState("");

  const filteredModules = useMemo(() => {
    if (!modulesData) return [];
    if (!searchValue.trim()) return modulesData;
    const search = searchValue.toLowerCase();
    return modulesData.filter(
      (module) =>
        module.moduleName.toLowerCase().includes(search) ||
        module.name?.toLowerCase().includes(search)
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
            <CardTitle className="text-xl text-high-emphasis">
              Language Modules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-4">
              <div className="w-[300px]">
                <FilterControls.SearchInput
                  value={searchValue}
                  onChange={setSearchValue}
                  placeholder="Search modules..."
                  className="h-9 w-full"
                />
              </div>
            </div>
            <div className="w-full overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="font-bold text-medium-emphasis">Module Name</TableHead>
                    <TableHead className="font-bold text-medium-emphasis">Created By</TableHead>
                    <TableHead className="font-bold text-medium-emphasis">Created Date</TableHead>
                    <TableHead className="w-[50px] font-bold text-medium-emphasis">Actions</TableHead>
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
                  ) : filteredModules.length > 0 ? (
                    filteredModules.map((module) => (
                      <TableRow
                        key={module.itemId}
                        className="font-normal text-medium-emphasis hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">{module.moduleName}</TableCell>
                        <TableCell>{getUserDisplayName(module.createdBy)}</TableCell>
                        <TableCell>
                          {module.createDate
                            ? new Date(module.createDate).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <RowActionsCell
                            onEdit={() => {
                              // TODO: Implement edit functionality when API is available
                              toast({
                                variant: "default",
                                title: "Coming Soon",
                                description: "Edit functionality will be available soon.",
                              });
                            }}
                            onDelete={() => {
                              toast({
                                variant: "default",
                                title: "Coming Soon",
                                description: "Delete functionality will be available soon.",
                              });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        {searchValue ? "No modules match your search." : "No modules found. Create your first module to get started."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isNewModuleDialogOpen} onOpenChange={setIsNewModuleDialogOpen}>
          <NewModule onClose={() => {
            setIsNewModuleDialogOpen(false);
            refetch();
          }} />
        </Dialog>
      </div>
    </main>
  );
}
