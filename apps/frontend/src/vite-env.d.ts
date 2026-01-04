/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_PEER_SERVER_HOST: string;
  readonly VITE_PEER_SERVER_PORT: string;
  readonly VITE_PEER_SERVER_SECURE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
