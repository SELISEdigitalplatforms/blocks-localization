/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BLOCKS_X_BLOCKS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
