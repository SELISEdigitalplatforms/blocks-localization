import { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Info,
  Pencil,
  Plus,
  Server,
  Trash2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-kits/accordion/accordion";
import { Card } from "@/components/ui-kits/card/card";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { SETUP_STEPS } from "../../constants/extension-guides.constant";
import { CopyableSnippet } from "@/components/copyable-snippet/copyable-snippet";

export const ExtensionGuides = () => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const apiBaseUrl = getRuntimeEnv("BLOCKS_PUBLIC_API_BASE_URL");
  const blocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");
  const localizationBaseUrl =
    getRuntimeEnv("BLOCKS_LOCALIZATION_BASE_URL") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const extensionConfig = JSON.stringify(
    {
      BLOCKS_PUBLIC_API_BASE_URL: apiBaseUrl,
      BLOCKS_X_BLOCKS_KEY: blocksKey,
    },
    null,
    2,
  );
  const runtimeConfigCommand = localizationBaseUrl
    ? `curl ${localizationBaseUrl.replace(/\/+$/, "")}`
    : "";

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
            Connect SELISE Blocks Assistant to a Blocks OS instance.
          </p>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5 p-4 sm:p-5">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="font-medium">Before you begin</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Get the API Base URL and X-Blocks-Key from your Blocks OS
              administrator. Keep the key private and only enter it in the
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

        <Accordion type="multiple" className="mt-4">
          {SETUP_STEPS.map((item, index) => (
            <AccordionItem
              key={item.title}
              value={`setup-step-${index + 1}`}
              className="last:border-b-0"
            >
              <AccordionTrigger className="gap-4 py-4 text-left hover:no-underline">
                <span className="flex min-w-0 items-center gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="font-medium">{item.title}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pl-12">
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
                {item.image && (
                  <figure className="mt-4 w-52 max-w-full overflow-hidden rounded-xl border bg-muted/30 p-2 shadow-sm">
                    <img
                      src={item.image.src}
                      alt={item.image.alt}
                      width={item.image.width}
                      height={item.image.height}
                      loading="lazy"
                      decoding="async"
                      className="h-auto w-full rounded-lg border object-contain"
                    />
                    <figcaption className="px-2 pb-1 pt-3 text-xs text-muted-foreground">
                      {item.image.caption}
                    </figcaption>
                  </figure>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-6 border-t pt-6">
          <h3 className="font-semibold">Alternative setup options</h3>

          <div className="mt-4 space-y-5">
            <div>
              <h4 className="text-sm font-medium">
                Copy the instance configuration as JSON
              </h4>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Copy this configuration and use the API Base URL and
                X-Blocks-Key values when adding the Blocks OS instance in the
                extension.
              </p>
              <div className="mt-3">
                <CopyableSnippet
                  id="extension-config-json"
                  label="Instance configuration (JSON)"
                  value={extensionConfig}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium">
                Get the runtime configuration with curl
              </h4>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Run this command in your terminal using your localization
                domain. In the response, find{" "}
                <code className="font-medium text-foreground">
                  BLOCKS_PUBLIC_API_BASE_URL
                </code>{" "}
                and{" "}
                <code className="font-medium text-foreground">
                  BLOCKS_X_BLOCKS_KEY
                </code>{" "}
                under the runtime environment configuration.
              </p>
              <div className="mt-3">
                <CopyableSnippet
                  id="runtime-config-curl"
                  label="Terminal command"
                  value={runtimeConfigCommand}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Example: <code>curl https://localization.seliseblocks.com</code>
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Blocks OS</h2>
              <span className="rounded-full border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary">
                V4
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Blocks OS instance using microservice version V4.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <CopyableSnippet
            id="v4-api-base-url"
            label="API Base URL"
            value={apiBaseUrl}
            copiedField={copiedField}
            onCopy={copyToClipboard}
          />
          <CopyableSnippet
            id="v4-blocks-key"
            label="X-Blocks-Key"
            value={blocksKey}
            copiedField={copiedField}
            onCopy={copyToClipboard}
          />
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
