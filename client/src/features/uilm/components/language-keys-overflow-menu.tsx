import { useUilmExportDownloadListener } from "@/features/uilm/hooks/use-uilm-export-download-listener";
import { useUilmProjectKey, useUilmTranslateAll } from "@/features/uilm/hooks/use-uilm-queries";
import { Button } from "@/platform/ui/components/button/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/platform/ui/components/dropdown-menu/dropdown-menu";
import {
  EllipsisVertical,
  FolderInput,
  FolderOutput,
  History,
  Plus,
  Wand,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NewModuleModal } from "@/features/uilm/components/new-module-modal";
import { ImportKeysModal } from "@/features/uilm/components/import-keys-modal";
import { ExportKeysModal } from "@/features/uilm/components/export-keys-modal";

type DialogKind = "translate" | "import" | "export" | null;

export function LanguageKeysOverflowMenu() {
  const navigate = useNavigate();
  const projectKey = useUilmProjectKey();
  useUilmExportDownloadListener(projectKey);
  const { isPending: isTranslateAllPending, mutateAsync: translateAllAsync } = useUilmTranslateAll();

  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [newModuleOpen, setNewModuleOpen] = useState(false);

  const onConfirmTranslateAll = async () => {
    if (!projectKey) {
      showErrorToast({ errors: "Select a project in the console header." });
      return;
    }
    try {
      const res = await translateAllAsync({
        projectKey,
        messageCoRelationId: "",
        defaultLanguage: "en-US",
      });
      if (res?.isSuccess) {
        showSuccessToast({
          title: "Processing Translation",
          description: "Keys translation in progress.",
        });
        setDialogKind(null);
      } else {
        showErrorToast({ errors: res?.errors ?? "Translation failed" });
      }
    } catch (e) {
      showErrorToast({ errors: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-10 w-10 p-0">
            <EllipsisVertical className="h-5 w-5" />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setDialogKind("translate")}
          >
            <Wand className="mr-2 h-4 w-4" />
            <span>Auto-translate all</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setNewModuleOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>New Module</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setDialogKind("import")}
          >
            <FolderInput className="mr-2 h-4 w-4" />
            <span>Import keys</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setDialogKind("export")}
          >
            <FolderOutput className="mr-2 h-4 w-4" />
            <span>Export keys</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => navigate("/services/language/export-history")}
          >
            <History className="mr-2 h-4 w-4" />
            <span>Export History</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog roots stay mounted; `open` toggles so overlay/content enter animations run (see platform dialog: center fade). */}
      <Dialog
        open={dialogKind === "translate"}
        onOpenChange={(o) => {
          if (!o) setDialogKind(null);
        }}
      >
        {dialogKind === "translate" ? (
          <DialogContent>
            <DialogHeader className="mb-4">
              <DialogTitle>Auto-translate all keys</DialogTitle>
              <p className="mt-3 font-normal text-medium-emphasis">
                Are you sure you want to automatically translate all keys?
              </p>
            </DialogHeader>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                disabled={isTranslateAllPending}
                variant="secondary"
                className="min-w-[80px]"
                onClick={() => setDialogKind(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isTranslateAllPending || !projectKey}
                className="min-w-[80px]"
                onClick={() => void onConfirmTranslateAll()}
              >
                Yes
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={dialogKind === "import"}
        onOpenChange={(o) => {
          if (!o) setDialogKind(null);
        }}
      >
        {dialogKind === "import" ? (
          <ImportKeysModal dialogTitle="Import Keys" onClose={() => setDialogKind(null)} />
        ) : null}
      </Dialog>

      <Dialog
        open={dialogKind === "export"}
        onOpenChange={(o) => {
          if (!o) setDialogKind(null);
        }}
      >
        {dialogKind === "export" ? <ExportKeysModal onClose={() => setDialogKind(null)} /> : null}
      </Dialog>

      <Dialog open={newModuleOpen} onOpenChange={setNewModuleOpen}>
        {newModuleOpen ? <NewModuleModal onClose={setNewModuleOpen} /> : null}
      </Dialog>
    </>
  );
}
