/// <reference types="vite/client" />

interface ImportMetaEnv {
  // No Azure credentials needed in the frontend — all auth is handled by the BFF
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
