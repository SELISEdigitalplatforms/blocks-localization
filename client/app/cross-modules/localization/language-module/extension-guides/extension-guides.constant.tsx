import { ExternalLink, ListPlus } from "lucide-react";

export const EXTENSION_WEBSTORE_URL =
  "https://chromewebstore.google.com/detail/selise-blocks-assistant/ehnhmdghlkaeaiinoahgipdeogkikjem";

export const EXTENSION_API_BASE_URLS = {
  development: "https://dev-api.blocksdevelopers.com",
  staging: "https://stg-api.blocksdevelopers.com",
  production: "https://api.seliseblocks.com",
} as const;

export const getExtensionApiBaseUrl = (hostname: string): string => {
  const normalizedHostname = hostname.toLowerCase();

  const isStaging =
    normalizedHostname.startsWith("stg-") ||
    normalizedHostname.startsWith("staging-") ||
    normalizedHostname.includes(".stg.") ||
    normalizedHostname.includes(".staging.");

  if (isStaging) {
    return EXTENSION_API_BASE_URLS.staging;
  }

  const isLocal =
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1";
  const isDevelopment =
    isLocal ||
    normalizedHostname.startsWith("dev-") ||
    normalizedHostname.includes(".dev.");

  if (isDevelopment) {
    return EXTENSION_API_BASE_URLS.development;
  }

  return EXTENSION_API_BASE_URLS.production;
};

export const SETUP_STEPS = [
  {
    title: "Install the browser extension",
    description: (
      <>
        Install SELISE Blocks Assistant from the{" "}
        <a
          href={EXTENSION_WEBSTORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Chrome Web Store
          <ExternalLink className="h-3 w-3" />
        </a>
        , then open it to reach the sign-in screen.
      </>
    ),
  },
  {
    title: "Open Manage Instances",
    description: (
      <>
        On the sign-in screen, select the <strong>Manage instances</strong>{" "}
        button <ListPlus className="inline h-4 w-4" /> to the right of the{" "}
        <strong>Choose Instance</strong> list.
      </>
    ),
  },
  {
    title: "Add a cloud instance",
    description: (
      <>
        Select <strong>+ Add Cloud Instance</strong>. You can save up to 10
        instances and return here later to edit or remove them.
      </>
    ),
  },
  {
    title: "Enter the instance details",
    description: (
      <>
        Give the instance a recognizable name, select its microservice version,
        then copy the matching API Base URL and X-Blocks-Key from the Blocks
        instances section below and paste them into the extension.
      </>
    ),
  },
  {
    title: "Save and select the instance",
    description: (
      <>
        Select <strong>Save</strong>, return to the sign-in screen, and choose
        the new instance from the <strong>Choose Instance</strong> list. The
        selected instance is marked as active.
      </>
    ),
  },
  {
    title: "Sign in",
    description: (
      <>
        Enter the account credentials for the selected Blocks environment and
        select <strong>Sign in</strong>. You can now use the extension with that
        instance.
      </>
    ),
  },
] as const;
