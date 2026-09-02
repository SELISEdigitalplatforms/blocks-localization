import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, FileText, LoaderCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-kits/accordion/accordion";
import { Button } from "@/components/ui-kits/button/button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Card } from "@/components/ui-kits/card/card";
import { getRuntimeEnv } from "@/lib/runtime-env";
import {
  getBlocksOsRolesPath,
  getBlocksOsClientCredentialsPath,
  getWordPressPluginGuideSteps,
} from "../../constants/wordpress-plugin-guide.constant";
import { CopyableSnippet } from "@/components/copyable-snippet/copyable-snippet";
import { useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import {
  fetchBlocksOsRedirectUrl,
  fetchIamClientCredentials,
  findWordPressClientCredentials,
  hasWpCredentialRole,
  type IamClientCredential,
} from "@blocks-localization/services/wordpress-plugin.service";
import { showErrorToast } from "@/hooks/use-toast";
import { format, isValid } from "date-fns";

const maskCredentialValue = (value: string) => {
  if (!value) return "N/A";
  if (value.length <= 8) return "*".repeat(value.length);

  return `${value.slice(0, 4)}${"*".repeat(Math.min(value.length - 8, 20))}${value.slice(-4)}`;
};

const formatCredentialDate = (value?: string) => {
  if (!value) return "N/A";

  const date = new Date(value);
  if (!isValid(date)) return "N/A";

  return format(date, "dd/MM/yyyy HH:mm");
};

const getCredentialStatusMessage = (
  credential: IamClientCredential,
  hasWordPressRole: boolean,
) => {
  if (!credential.isActive) return "Credential is inactive";
  if (!hasWordPressRole) return "wp_user role is missing";

  return "Credential values are incomplete";
};

export const WordPressPluginGuide = () => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRedirectingToOs, setIsRedirectingToOs] = useState(false);
  const selectedProject = useProjectStore().selectedProject;
  const projectKey = selectedProject?.tenantId ?? "";
  const projectId = selectedProject?.itemId ?? "";
  const blocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");
  const applicationOrigin =
    globalThis.location === undefined ? "" : globalThis.location.origin;

  const {
    data: iamClientCredentials,
    isLoading: areCredentialsLoading,
    isError: didCredentialsFail,
    refetch: refetchCredentials,
  } = useQuery<IamClientCredential[], Error>({
    queryKey: ["wordpress-plugin-client-credentials", projectKey],
    queryFn: fetchIamClientCredentials,
    enabled: Boolean(projectKey),
    retry: false,
  });

  const wordpressCredentials = findWordPressClientCredentials(iamClientCredentials);
  const hasBlocksKey = Boolean(blocksKey) && !blocksKey.startsWith("__BLOCKS_");

  useEffect(() => {
    if (!copiedField) return;

    const timeout = globalThis.setTimeout(() => setCopiedField(null), 2000);
    return () => globalThis.clearTimeout(timeout);
  }, [copiedField]);

  const copyToClipboard = async (value: string, id: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API not available");
      }
      await navigator.clipboard.writeText(value);
      setCopiedField(id);
    } catch {
      setCopiedField(null);
    }
  };

  const handleGoToBlocksOs = async (forwardedTo: string) => {
    if (!projectId || isRedirectingToOs) return;

    setIsRedirectingToOs(true);
    const osWindow = globalThis.open("about:blank", "_blank");
    if (osWindow) osWindow.opener = null;

    try {
      const redirectUrl = await fetchBlocksOsRedirectUrl(forwardedTo);
      if (osWindow) {
        osWindow.location.replace(redirectUrl);
        setIsRedirectingToOs(false);
      } else {
        globalThis.location.replace(redirectUrl);
      }
    } catch {
      osWindow?.close();
      setIsRedirectingToOs(false);
      showErrorToast({ errors: "Unable to redirect to Blocks OS. Please try again." });
    }
  };

  const wordpressPluginGuideSteps = getWordPressPluginGuideSteps({
    isRedirectingToOs: isRedirectingToOs || !projectId,
    onOpenRoles: () => void handleGoToBlocksOs(getBlocksOsRolesPath(projectId)),
    onOpenClientCredentials: () =>
      void handleGoToBlocksOs(getBlocksOsClientCredentialsPath(projectId)),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">WordPress Plugin Guide</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your WordPress site to Blocks Localization.
          </p>
        </div>
      </div>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Setup Status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          To integrate Blocks Localization with WordPress translation management, you need the
          following credentials configured.
        </p>

        <div className="mt-5">
          <h3 className="text-sm font-semibold">Project configuration</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="flex gap-3 rounded-lg border p-4">
              {hasBlocksKey ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              )}
              <div className="min-w-0 flex-1">
                {hasBlocksKey ? (
                  <CopyableSnippet
                    id="wordpress-x-blocks-key"
                    label="X-Blocks-Key"
                    value={blocksKey}
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                  />
                ) : (
                  <>
                    <h4 className="text-sm font-medium">X-Blocks-Key</h4>
                    <p className="mt-1 text-sm text-muted-foreground">Not configured</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              <div className="min-w-0 flex-1">
                <CopyableSnippet
                  id="wordpress-application-origin"
                  label="Origin"
                  value={applicationOrigin}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">WordPress client credentials</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Use any active credential with the wp_user role to configure a WordPress site.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!areCredentialsLoading && !didCredentialsFail && (
                <Badge variant="secondary">
                  {wordpressCredentials.length} credential
                  {wordpressCredentials.length === 1 ? "" : "s"}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={!projectId || isRedirectingToOs}
                onClick={() => void handleGoToBlocksOs(getBlocksOsClientCredentialsPath(projectId))}
              >
                {isRedirectingToOs ? "Redirecting..." : "Manage in Blocks OS"}
                {isRedirectingToOs ? (
                  <LoaderCircle className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {areCredentialsLoading && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading client credentials...
            </div>
          )}

          {didCredentialsFail && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Client credentials could not be loaded.
              </div>
              <Button variant="outline" size="sm" onClick={() => void refetchCredentials()}>
                Try again
              </Button>
            </div>
          )}

          {!areCredentialsLoading && !didCredentialsFail && wordpressCredentials.length === 0 && (
            <div className="mt-4 rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">No WordPress client credentials found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a client credential or assign the wp_user role to an existing credential.
              </p>
            </div>
          )}

          {wordpressCredentials.length > 0 && (
            <Accordion
              type="multiple"
              defaultValue={[wordpressCredentials[0].itemId || wordpressCredentials[0].name]}
              className="mt-4 space-y-4"
            >
              {wordpressCredentials.map((credential) => {
                const hasWordPressRole = hasWpCredentialRole(credential);
                const isReady =
                  credential.isActive &&
                  hasWordPressRole &&
                  Boolean(credential.itemId) &&
                  Boolean(credential.clientSecret);
                const credentialId = credential.itemId || credential.name;

                return (
                  <AccordionItem
                    key={credentialId}
                    value={credentialId}
                    className="overflow-hidden rounded-lg border px-5 sm:px-6"
                  >
                    <AccordionTrigger className="gap-4 py-5 text-left hover:no-underline">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 pr-2">
                        <h4 className="break-all text-lg font-semibold">{credential.name}</h4>
                        <Badge variant={credential.isActive ? "success" : "outline"}>
                          {credential.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {!isReady && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            {getCredentialStatusMessage(credential, hasWordPressRole)}
                          </div>
                        )}
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pb-6">
                      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 2xl:grid-cols-3">
                        <CopyableSnippet
                          id={`wordpress-${credentialId}-client-id`}
                          label="Client ID"
                          value={credential.itemId}
                          displayValue={maskCredentialValue(credential.itemId)}
                          copiedField={copiedField}
                          onCopy={copyToClipboard}
                        />
                        <CopyableSnippet
                          id={`wordpress-${credentialId}-client-secret`}
                          label="Client Secret"
                          value={credential.clientSecret}
                          displayValue={maskCredentialValue(credential.clientSecret)}
                          copiedField={copiedField}
                          onCopy={copyToClipboard}
                        />
                        <div>
                          <p className="text-sm text-muted-foreground">Token lifetime</p>
                          <p className="mt-2 text-sm sm:text-base">
                            {credential.accessTokenValidForNumberMinutes == null
                              ? "N/A"
                              : `${credential.accessTokenValidForNumberMinutes} min`}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Role(s)</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {credential.roles.length > 0 ? (
                              credential.roles.map((role) => (
                                <Badge key={role} variant="secondary" className="font-mono">
                                  {role}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm sm:text-base">N/A</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Permission(s)</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {credential.permissions?.length ? (
                              credential.permissions.map((permission) => (
                                <Badge key={permission} variant="secondary" className="font-mono">
                                  {permission}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm sm:text-base">N/A</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Created on</p>
                          <p className="mt-2 text-sm sm:text-base">
                            {formatCredentialDate(credential.createdDate)}
                          </p>
                        </div>
                        <div className="2xl:col-start-3">
                          <p className="text-sm text-muted-foreground">Updated on</p>
                          <p className="mt-2 text-sm sm:text-base">
                            {formatCredentialDate(credential.lastUpdatedDate)}
                          </p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Setup Instructions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow these steps to configure the Blocks Localization WordPress plugin.
        </p>

        <Accordion type="multiple" className="mt-4">
          {wordpressPluginGuideSteps.map((item, index) => (
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
                <div className="text-sm leading-6 text-muted-foreground">{item.description}</div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
};
