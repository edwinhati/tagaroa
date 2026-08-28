/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_BASE_URL?: string;
  readonly VITE_POST_SIGNIN_URL?: string;
  readonly VITE_TRUSTED_REDIRECT_ORIGINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
