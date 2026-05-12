import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import NewModule from "@blocks-localization/components/modals/new-module/new-module";
import { useGetLanguageModules, useDeleteLanguageModule } from "@blocks-localization/hooks/use-language-manager";
import { IModuleGets } from "@blocks-localization/models/language";
import { FilterControls } from "@/components/filter-toolbar";
import { useCallback, useMemo, useState } from "react";
import { EllipsisVertical, FolderInput, FolderOutput, History, Plus, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { toast } from "@/hooks/use-toast";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { useProjectStore } from "@/store/useProjectStore";

export function ModuleTable() {
  const navigate = useNavigate();
  const { isLoading, data: modulesData, refetch } = useGetLanguageModules();
  const [isNewModuleDialogOpen, setIsNewModuleDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const { isPending: isDeletePending, mutateAsync: deleteAsync } = useDeleteLanguageModule();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

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

  const handleDeleteClick = (itemId: string) => {
    setIsDeleteDialogOpen(true);
    setSelectedModuleId(itemId);
  };

  const onConfirmDelete = async () => {
    try {
      const res = await deleteAsync({ itemId: selectedModuleId ?? "", projectKey: tenantId });
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: "Module deleted successfully",
        });
        setIsDeleteDialogOpen(false);
        refetch();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: JSON.stringify(res?.errors),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(error),
      });
    }
  };

  const deleteModuleModalData = {
    dialogTitle: "Delete module?",
    dialogSubtitle: "Are you sure you want to delete this module? This action cannot be undone.",
    confirmButton: "Delete",
    cancelButton: "Cancel",
  };

  return (
    <main className="flex flex-col">
      <div className="flex w-full flex-col">
        <div className="flex w-full justify-between text-high-emphasis">
          <div className="item-center flex gap-2">
            <h3 className="text-2xl font-bold tracking-tight">Modules</h3>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 w-10 p-0">
                  <EllipsisVertical width={20} height={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="cursor-pointer" onSelect={handleNewModuleClick}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span>New Module</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={() => navigate("/services/language/export-history")}
                >
                  <History className="mr-2 h-4 w-4" />
                  <span>Export History</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <CardHeader className="flex items-center justify-between">
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
                    <TableHead className="font-bold text-medium-emphasis">Last Updated By</TableHead>
                    <TableHead className="font-bold text-medium-emphasis">Last Updated Date</TableHead>
                    <TableHead className="w-[50px] font-bold text-medium-emphasis">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        {[1, 2, 3, 4, 5, 6].map((_, colIndex) => (
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
                        className="cursor-pointer font-normal text-medium-emphasis hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">{module.moduleName}</TableCell>
                        <TableCell>{module.createdBy || "—"}</TableCell>
                        <TableCell>
                          {module.createDate
                            ? new Date(module.createDate).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>{module.lastUpdatedBy || "—"}</TableCell>
                        <TableCell>
                          {module.lastUpdateDate
                            ? new Date(module.lastUpdateDate).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 text-error hover:text-error hover:bg-error/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(module.itemId);
                            }}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
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

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <ConfirmationModal
            onCancel={() => {}}
            onConfirm={onConfirmDelete}
            data={deleteModuleModalData}
            buttonState={{ confirm: { disable: isDeletePending } }}
          />
        </Dialog>
      </div>
    </main>
  );
}
