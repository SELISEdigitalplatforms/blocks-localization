import { env } from "@/config/env";
import { LanguageKeysOverflowMenu } from "@/features/uilm/components/language-keys-overflow-menu";
import { LanguageKeysPanel } from "@/features/uilm/components/language-keys-panel";
import { LocalizationTimelinePanel } from "@/features/uilm/components/localization-timeline-panel";
import { useUilmGenerateUilmFile, useUilmProjectKey } from "@/features/uilm/hooks/use-uilm-queries";
import { Button } from "@/platform/ui/components/button/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import {
  segmentedTabsListClass,
  segmentedTabsTriggerClass,
} from "@/platform/ui/components/tabs/segmented-tabs-classes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/platform/ui/components/tabs/tabs";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { Loader2, Plus, Rocket, Settings } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

export function LanguageWorkspacePage() {
  const navigate = useNavigate();
  const projectKey = useUilmProjectKey();
  const generateFile = useUilmGenerateUilmFile();
  const [tab, setTab] = useState<"keys" | "history">("keys");
  const [publishOpen, setPublishOpen] = useState(false);

  const swaggerUrl = `${env.apiBaseUrl.replace(/\/$/, "")}/uilm/v1/swagger/index.html`;

  async function onConfirmPublish() {
    if (!projectKey) return;
    try {
      const res = await generateFile.mutateAsync({
        guid: uuidv4(),
        projectKey,
      });
      if (res?.isSuccess) {
        showSuccessToast({ description: "File generation is in progress." });
        setPublishOpen(false);
      } else {
        showErrorToast({ errors: res?.errors ?? "Publish failed" });
      }
    } catch (e) {
      showErrorToast({ errors: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-high-emphasis">Language</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => window.open(swaggerUrl, "_blank", "noopener,noreferrer")}
          >
            API Docs
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => navigate("/services/language/configure")}
          >
            <Settings className="h-4 w-4" />
            Configure
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "keys" | "history")} className="mt-[18px] flex w-full flex-col md:mt-[24px]">
        <div className="mb-5 flex items-center text-base">
          <TabsList className={segmentedTabsListClass}>
            <TabsTrigger value="keys" className={segmentedTabsTriggerClass}>
              Translation Keys
            </TabsTrigger>
            <TabsTrigger value="history" className={segmentedTabsTriggerClass}>
              History
            </TabsTrigger>
          </TabsList>
          {tab === "keys" ? (
            <div className="ml-auto flex items-center gap-2">
              <LanguageKeysOverflowMenu />
              <Button
                type="button"
                variant="outline"
                size="default"
                className="shadow-none"
                onClick={() => setPublishOpen(true)}
              >
                <Rocket className="mr-2 h-5 w-5" />
                Publish Changes
              </Button>
              <Button
                type="button"
                size="default"
                className="bg-primary text-primary-foreground shadow-none"
                onClick={() => navigate("/services/language/translations/new-key")}
              >
                <Plus className="mr-2 h-5 w-5" />
                New Key
              </Button>
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-2"></div>
          )}
        </div>

        <TabsContent value="keys" className="mt-0">
          <LanguageKeysPanel />
        </TabsContent>
        <TabsContent value="history" className="mt-0">
          <LocalizationTimelinePanel />
        </TabsContent>
      </Tabs>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish changes?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to publish the changes?</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!projectKey || generateFile.isPending}
              onClick={onConfirmPublish}
            >
              {generateFile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
