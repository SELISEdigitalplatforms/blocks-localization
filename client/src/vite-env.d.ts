/// <reference types="vite/client" />

/** Exposed when `envPrefix` is `['BLOCKS_']` and keys are set in the monolith root `.env`. */
interface ImportMetaEnv {
  readonly BLOCKS_APP_URL?: string;
  readonly BLOCKS_API_BASE_URL?: string;
  readonly BLOCKS_API_BASE_URL_LOCAL?: string;
  /** Dev: optional JWT; sent as Bearer to local API when `BLOCKS_API_BASE_URL_LOCAL` is used (see `local-api-bearer.ts`). */
  readonly BLOCKS_LOCAL_API_BEARER?: string;
  readonly BLOCKS_X_BLOCKS_KEY?: string;
  readonly BLOCKS_CONSTRUCT_URL?: string;
  readonly BLOCKS_PROJECT_DEFAULT_API_BASE_URL?: string;
  readonly BLOCKS_GOOGLE_SITE_KEY?: string;
  readonly BLOCKS_BLOCKS_DEFAULT_STORAGE_HOST?: string;
  readonly BLOCKS_BLOCKED_MENU?: string;
  readonly BLOCKS_AI_WIDGET_CDN_LINK?: string;
  readonly BLOCKS_GITHUB_SSO_CLIENT_ID?: string;
  readonly BLOCKS_CLARITY_PROJECT_ID?: string;
  readonly BLOCKS_APP_ENV?: string;
  readonly BLOCKS_WIDGET_ID?: string;
  readonly BLOCKS_WIDGET_URL?: string;
  readonly BLOCKS_SCA_PORTAL_LINK?: string;
  readonly BLOCKS_BLOCKED_KEY?: string;
  readonly BLOCKS_BLOCKED_USER_IDS?: string;
  readonly BLOCKS_UILM_PROJECT_KEY?: string;
  readonly BLOCKS_PUBLIC_BASE_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Selise Blocks chat widget (`embed.js`) — see `shell/blocks-chatbot-embed.tsx`. */
interface SeliseBlocksChatbotAPI {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpened: () => boolean;
  emit: (message: { type: string; data: unknown }) => void;
}

interface Window {
  SeliseBlocksChatbot?: SeliseBlocksChatbotAPI;
}
