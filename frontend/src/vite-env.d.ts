/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: "local" | "staging" | "production";
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ENABLE_MOCKS?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
