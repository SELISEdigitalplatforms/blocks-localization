import { useEffect, useState } from "react";
import { Check, CheckCircle2, Copy, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-kits/accordion/accordion";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { KEY_MODE_INSTRUCTIONS_MD, getSetupSteps } from "../../constants/extension-guides.constant";
import { renderRichText } from "../../utils/rich-text-slots";
import { CopyableSnippet } from "@/components/copyable-snippet/copyable-snippet";

const MODULE = "localization.tools";

/**
 * Drops trailing slashes without a regex. `/\/+$/` is an anchored repeat, so a long run of
 * slashes that fails to match backtracks quadratically.
 */
function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end--;
  }
  return value.slice(0, end);
}

const renderBold = (text: string) =>
  renderRichText(text, {
    b: (children) => <strong className="font-medium text-foreground">{children}</strong>,
    code: (children) => <code className="font-medium text-foreground">{children}</code>,
  });

export const ExtensionGuides = () => {
  const { t } = useT(MODULE);
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
    ? `curl ${trimTrailingSlashes(localizationBaseUrl)}`
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
          <h1 className="text-2xl font-semibold">{t("EXTENSION_GUIDES.TITLE")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("EXTENSION_GUIDES.SUBTITLE")}</p>
        </div>
      </div>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{t("EXTENSION_GUIDES.SETUP_TITLE")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("EXTENSION_GUIDES.SETUP_SUBTITLE")}</p>

        <Accordion type="multiple" className="mt-4">
          {getSetupSteps().map((item, index) => (
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
                        className="mt-4 w-52 max-w-full overflow-hidden rounded-xl border bg-muted/30 p-2 shadow-xs"
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
        <h2 className="text-lg font-semibold">{t("EXTENSION_GUIDES.ALTERNATIVE_TITLE")}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("EXTENSION_GUIDES.ALTERNATIVE_SUBTITLE")}
        </p>

        <div className="mt-5 rounded-lg border p-4 sm:p-5">
          <h3 className="font-semibold">{t("EXTENSION_GUIDES.JSON_TITLE")}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("EXTENSION_GUIDES.JSON_DESCRIPTION")}
          </p>

          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>{renderBold(t("EXTENSION_GUIDES.JSON_STEP_1"))}</li>
            <li>{renderBold(t("EXTENSION_GUIDES.JSON_STEP_2"))}</li>
            <li>{renderBold(t("EXTENSION_GUIDES.JSON_STEP_3"))}</li>
            <li>{renderBold(t("EXTENSION_GUIDES.JSON_STEP_4"))}</li>
          </ol>

          <div className="mt-4">
            <CopyableSnippet
              id="extension-config-json"
              label={t("EXTENSION_GUIDES.JSON_SNIPPET_LABEL")}
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
                <h3 className="font-semibold">{t("EXTENSION_GUIDES.MANUAL_TITLE")}</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {renderBold(t("EXTENSION_GUIDES.MANUAL_DESCRIPTION"))}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <CopyableSnippet
              id="v4-api-base-url"
              label={t("EXTENSION_GUIDES.API_BASE_URL_LABEL")}
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
          <h3 className="font-semibold">{t("EXTENSION_GUIDES.CURL_TITLE")}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {renderBold(t("EXTENSION_GUIDES.CURL_DESCRIPTION"))}
          </p>
          <div className="mt-3">
            <CopyableSnippet
              id="runtime-config-curl"
              label={t("EXTENSION_GUIDES.TERMINAL_COMMAND_LABEL")}
              value={runtimeConfigCommand}
              copiedField={copiedField}
              onCopy={copyToClipboard}
            />
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{t("EXTENSION_GUIDES.MANAGE_TITLE")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex gap-3 rounded-lg border p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-medium">{t("EXTENSION_GUIDES.ACTIVE_TITLE")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("EXTENSION_GUIDES.ACTIVE_DESCRIPTION")}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border p-4">
            <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-medium">{t("EXTENSION_GUIDES.EDIT_TITLE")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("EXTENSION_GUIDES.EDIT_DESCRIPTION")}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border p-4">
            <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-medium">{t("EXTENSION_GUIDES.REMOVE_TITLE")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("EXTENSION_GUIDES.REMOVE_DESCRIPTION")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Plus className="h-4 w-4 text-primary" />
          <span>{renderBold(t("EXTENSION_GUIDES.ADD_ENVIRONMENT"))}</span>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{t("EXTENSION_GUIDES.KEY_MODE_TITLE")}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("EXTENSION_GUIDES.KEY_MODE_DESCRIPTION")}
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-4 gap-2"
          aria-label={t("EXTENSION_GUIDES.COPY_KEY_MODE_ARIA")}
          onClick={() => copyToClipboard(KEY_MODE_INSTRUCTIONS_MD, "key-mode-instructions")}
        >
          {copiedField === "key-mode-instructions" ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copiedField === "key-mode-instructions"
            ? t("common:COPIED")
            : t("EXTENSION_GUIDES.COPY_INSTRUCTIONS")}
        </Button>
      </Card>
    </div>
  );
};
