import type { ReactNode } from "react";
import { ExternalLink, Key, Shield } from "lucide-react";
import { deriveOsBaseUrl } from "@/lib/blocks-url.util";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { tStatic } from "@seliseblocks/genesis-os/i18n";
import { renderRichText } from "../utils/rich-text-slots";

const MODULE = "localization.tools";

const text = (key: string) => tStatic(MODULE, key);
const bold = { b: (children: ReactNode) => <strong>{children}</strong> };

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
      title: text("WORDPRESS_PLUGIN_GUIDE_STEPS.STEP_1_TITLE"),
      description: (
        <>
          {renderRichText(text("WORDPRESS_PLUGIN_GUIDE_STEPS.STEP_1_DESCRIPTION"), {
            ...bold,
            roles: (children) => (
              <button
                type="button"
                disabled={isRedirectingToOs}
                onClick={onOpenRoles}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                {children}
              </button>
            ),
            icon: () => <ExternalLink className="h-3 w-3" />,
          })}
        </>
      ),
      icon: Shield,
    },
    {
      title: text("WORDPRESS_PLUGIN_GUIDE_STEPS.STEP_2_TITLE"),
      description: (
        <>
          {renderRichText(text("WORDPRESS_PLUGIN_GUIDE_STEPS.STEP_2_DESCRIPTION"), {
            ...bold,
            credentials: (children) => (
              <button
                type="button"
                disabled={isRedirectingToOs}
                onClick={onOpenClientCredentials}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                {children}
              </button>
            ),
            icon: () => <ExternalLink className="h-3 w-3" />,
          })}
        </>
      ),
      icon: Key,
    },
    {
      title: text("WORDPRESS_PLUGIN_GUIDE_STEPS.STEP_3_TITLE"),
      description: (
        <>
          {text("WORDPRESS_PLUGIN_GUIDE_STEPS.STEP_3_INTRO")}
          <ul className="mt-2 list-disc pl-5">
            <li>{renderRichText(text("WORDPRESS_PLUGIN_GUIDE_STEPS.STEP_3_BLOCKS_KEY"), bold)}</li>
            <li>{renderRichText(text("WORDPRESS_PLUGIN_GUIDE_STEPS.STEP_3_CLIENT_ID"), bold)}</li>
            <li>
              {renderRichText(text("WORDPRESS_PLUGIN_GUIDE_STEPS.STEP_3_CLIENT_SECRET"), bold)}
            </li>
            <li>{renderRichText(text("WORDPRESS_PLUGIN_GUIDE_STEPS.STEP_3_ORIGIN"), bold)}</li>
          </ul>
        </>
      ),
      icon: Key,
    },
  ] as const;
