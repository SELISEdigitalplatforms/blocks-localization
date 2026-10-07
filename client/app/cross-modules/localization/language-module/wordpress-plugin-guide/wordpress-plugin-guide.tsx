import { ExternalLink, LoaderCircle, Puzzle } from "lucide-react";
import { useState } from "react";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { showErrorToast } from "@/hooks/use-toast";
import { fetchBlocksOsRedirectUrl } from "@blocks-localization/services/wordpress-plugin.service";

export const WordPressPluginGuide = () => {
  const [opening, setOpening] = useState(false);
  const projectId = useProjectStore()?.selectedProject?.itemId;

  const openIntegrations = async () => {
    if (!projectId) return;
    setOpening(true);
    try {
      globalThis.location.assign(await fetchBlocksOsRedirectUrl(`/app/${encodeURIComponent(projectId)}/secret-management/integration`));
    } catch {
      showErrorToast({ errors: "Could not open Integrations in Blocks OS." });
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Puzzle className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">WordPress Plugin Guide</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your WordPress site to Blocks Localization from Integrations in Blocks OS.
          </p>
        </div>
      </div>

      <Card className="p-4 sm:p-6">
        <p className="text-base leading-7 text-muted-foreground">
          Create a connection there, then copy its one-time credentials into the plugin.
        </p>
        <Button className="mt-4" onClick={openIntegrations} disabled={opening || !projectId}>
          {opening ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
          Open Integrations in Blocks OS
        </Button>
      </Card>
    </div>
  );
};
