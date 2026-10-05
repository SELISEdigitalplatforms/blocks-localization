import { ExternalLink, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { Button } from "@/components/ui-kits/button/button";
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
    <div className="mx-auto max-w-2xl space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h1 className="text-xl font-semibold">WordPress Plugin Guide</h1>
        <p className="mt-1 text-sm text-medium-emphasis">
          Connect your WordPress site to Blocks Localization from Integrations in Blocks OS.
        </p>
      </div>
      <Button onClick={openIntegrations} disabled={opening || !projectId}>
        {opening ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
        Open Integrations in Blocks OS
      </Button>
      <p className="text-xs text-medium-emphasis">Create a connection there, then copy its one-time credentials into the plugin.</p>
    </div>
  );
};
