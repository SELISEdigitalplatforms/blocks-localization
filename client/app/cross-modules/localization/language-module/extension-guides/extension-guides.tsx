import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  FileText,
  Info,
  KeyRound,
  Pencil,
  Plus,
  Server,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui-kits/card/card";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { CopyableSnippet } from "./copyable-snippet";
import {
  getExtensionApiBaseUrl,
  SETUP_STEPS,
} from "./extension-guides.constant";

export const ExtensionGuides = () => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const hostname =
    typeof window === "undefined" ? "" : window.location.hostname;
  const extensionApiBaseUrl = getExtensionApiBaseUrl(hostname);
  const blocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");
  const instanceTypes = [
    {
      icon: Cloud,
      version: "V1",
      name: "Blocks Cloud (Default)",
      description:
        "Choose this for a Blocks Cloud instance using microservice version V1.",
      apiBaseUrl: extensionApiBaseUrl,
      blocksKey,
    },
    {
      icon: Server,
      version: "V4",
      name: "Blocks OS",
      description:
        "Choose this for a Blocks OS instance using microservice version V4.",
      apiBaseUrl: extensionApiBaseUrl,
      blocksKey,
    },
  ];

  useEffect(() => {
    if (!copiedField) return;

    const timeout = window.setTimeout(() => setCopiedField(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [copiedField]);

  const copyToClipboard = async (value: string, id: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        try {
          textArea.select();
          if (!document.execCommand("copy")) {
            throw new Error("Copy command failed");
          }
        } finally {
          document.body.removeChild(textArea);
        }
      }
      setCopiedField(id);
    } catch {
      setCopiedField(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">Extension Guides</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect SELISE Blocks Assistant to a Blocks Cloud or Blocks OS
            instance.
          </p>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5 p-4 sm:p-5">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="font-medium">Before you begin</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirm whether your project uses Blocks Cloud V1 or Blocks OS V4.
              The correct API Base URL and X-Blocks-Key for each version are
              provided below. Keep the key private and only enter it in the
              official extension.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Set up a Blocks instance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow these steps from the extension sign-in screen.
        </p>

        <ol className="mt-6 space-y-0">
          {SETUP_STEPS.map((item, index) => (
            <li key={item.title} className="relative flex gap-4 pb-6 last:pb-0">
              {index < SETUP_STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  className="absolute bottom-0 left-4 top-8 w-px bg-border"
                />
              )}
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {index + 1}
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Blocks instances</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the version that matches your environment, then copy and paste
          its values into the corresponding fields in the extension.
        </p>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {instanceTypes.map((instance) => (
            <div key={instance.version} className="rounded-lg border p-4">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <instance.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{instance.name}</h3>
                    <span className="rounded-full border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary">
                      {instance.version}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {instance.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <CopyableSnippet
                  id={`${instance.version}-api-base-url`}
                  label="API Base URL"
                  value={instance.apiBaseUrl}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                />
                <CopyableSnippet
                  id={`${instance.version}-blocks-key`}
                  label="X-Blocks-Key"
                  value={instance.blocksKey}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Manage saved instances</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex gap-3 rounded-lg border p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-medium">Active instance</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The ACTIVE label identifies the instance currently selected for
                sign-in.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border p-4">
            <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-medium">Edit details</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Use the pencil button to update a saved instance configuration.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border p-4">
            <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-medium">Remove an instance</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Use the trash button to remove an instance you no longer need.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Plus className="h-4 w-4 text-primary" />
          Need another environment? Return to Manage Instances and select
          <span className="font-medium text-foreground">
            Add Cloud Instance
          </span>
          .
        </div>
      </Card>
    </div>
  );
};
