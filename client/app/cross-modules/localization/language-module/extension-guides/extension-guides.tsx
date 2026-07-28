import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Pencil, Plus, Trash2 } from "lucide-react";
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
                <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                {item.images.length > 0 && (
                  <div className="flex flex-wrap gap-4">
                    {item.images.map((image) => (
                      <figure
                        key={image.src}
                        className="mt-4 w-52 max-w-full overflow-hidden rounded-xl border bg-muted/30 p-2 shadow-sm"
                      >
                        <img
                          src={image.src}
                          alt={image.alt}
                          width={image.width}
                          height={image.height}
                          loading="lazy"
                          decoding="async"
                          className="h-auto w-full rounded-lg border object-contain"
                        />
                      </figure>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Alternative setup options</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Configure the Blocks OS V4 instance with JSON or enter the same values manually.
        </p>

        <div className="mt-5 rounded-lg border p-4 sm:p-5">
          <h3 className="font-semibold">JSON setup</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Paste the complete configuration into the extension instead of entering each value
            separately.
          </p>

          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>
              In the extension, enter an instance name and select{" "}
              <strong className="font-medium text-foreground">V4 – Blocks OS</strong>.
            </li>
            <li>
              Under <strong className="font-medium text-foreground">Setup Method</strong>, select{" "}
              <strong className="font-medium text-foreground">JSON</strong>.
            </li>
            <li>
              Copy the configuration below and paste it into{" "}
              <strong className="font-medium text-foreground">Blocks OS Configuration JSON</strong>.
            </li>
            <li>
              Select <strong className="font-medium text-foreground">Save</strong>.
            </li>
          </ol>

          <div className="mt-4">
            <CopyableSnippet
              id="extension-config-json"
              label="Blocks OS configuration (JSON)"
              value={extensionConfig}
              copiedField={copiedField}
              onCopy={copyToClipboard}
            />
          </div>
        </div>

        <div className="mt-5 rounded-lg border p-4 sm:p-5">
          <div className="flex gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">Manual setup</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Select <strong className="font-medium text-foreground">Manual</strong> under Setup
                Method, then copy the API Base URL and X-Blocks-Key into their matching fields.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
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
        </div>

        <div className="mt-5 rounded-lg border p-4 sm:p-5">
          <h3 className="font-semibold">Get the runtime configuration with curl</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Run this command in your terminal using your localization domain. In the response, find{" "}
            <code className="font-medium text-foreground">BLOCKS_PUBLIC_API_BASE_URL</code> and{" "}
            <code className="font-medium text-foreground">BLOCKS_X_BLOCKS_KEY</code> under the
            runtime environment configuration. Use those values for either setup method above.
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
                The ACTIVE label identifies the instance currently selected for sign-in.
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
          <span className="font-medium text-foreground">Add Cloud Instance</span>.
        </div>
      </Card>
    </div>
  );
};
