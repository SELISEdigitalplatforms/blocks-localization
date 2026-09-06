import { ExternalLink, Key, Shield } from "lucide-react";
import { deriveOsBaseUrl } from "@/lib/blocks-url.util";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const BLOCKS_OS_SETUP_URL = (
  getRuntimeEnv("BLOCKS_OS_BASE_URL") || deriveOsBaseUrl()
).replace(/\/$/, "");

export const getBlocksOsRolesPath = (projectId: string) =>
  `/app/${encodeURIComponent(projectId)}/idp/roles`;

export const getBlocksOsClientCredentialsPath = (projectId: string) =>
  `/app/${encodeURIComponent(projectId)}/secret-management/client-credentials`;

export const getBlocksOsClientCredentialsUrl = (projectId: string) =>
  `${BLOCKS_OS_SETUP_URL}${getBlocksOsClientCredentialsPath(projectId)}`;

interface WordPressPluginGuideActions {
  isRedirectingToOs: boolean;
  onOpenRoles: () => void;
  onOpenClientCredentials: () => void;
}

export const getWordPressPluginGuideSteps = ({
  isRedirectingToOs,
  onOpenRoles,
  onOpenClientCredentials,
}: WordPressPluginGuideActions) =>
  [
    {
      title: "Create wp-user role with permissions",
      description: (
        <>
          In Blocks OS, create a new role called <strong>wp-user</strong> and assign the necessary
          permissions for the Blocks Localization WordPress plugin to function correctly.{" "}
          <button
            type="button"
            disabled={isRedirectingToOs}
            onClick={onOpenRoles}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Go to Roles management
            <ExternalLink className="h-3 w-3" />
          </button>
        </>
      ),
      icon: Shield,
    },
    {
      title: "Create client credentials",
      description: (
        <>
          Create client credentials in Blocks OS and assign the <strong>wp-user</strong> role to it.
          This Client ID and Client Secret will be used to authenticate your WordPress instance.{" "}
          <button
            type="button"
            disabled={isRedirectingToOs}
            onClick={onOpenClientCredentials}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Go to Create Credentials
            <ExternalLink className="h-3 w-3" />
          </button>
        </>
      ),
      icon: Key,
    },
    {
      title: "Collect required credentials",
      description: (
        <>
          To integrate Blocks Localization with WordPress, you need the following credentials:
          <ul className="mt-2 list-disc pl-5">
            <li>
              <strong>X-Blocks-Key</strong> - Found in your Blocks Localization project settings
            </li>
            <li>
              <strong>Client Id</strong> - From the client credentials you created in Blocks OS
            </li>
            <li>
              <strong>Client Secret</strong> - From the client credentials you created in Blocks OS
            </li>
            <li>
              <strong>Origin</strong> - The Blocks Localization application origin shown in Setup
              Status
            </li>
          </ul>
        </>
      ),
      icon: Key,
    },
  ] as const;
