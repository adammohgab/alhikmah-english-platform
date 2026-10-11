import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/shared/config/env";
import type { Database } from "@/shared/types/database.types";

/**
 * Custom localStorage wrapper with defensive checks for environments without window/localStorage.
 */
const customStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore quota exceeded or storage blocked errors
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  },
};

/**
 * Singleton Supabase browser client with strict Database typing.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: customStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
