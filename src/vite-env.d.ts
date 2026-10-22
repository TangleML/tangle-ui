/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_TANGENT?: string;
  readonly VITE_TANGENT_REMOTE_ENV_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
