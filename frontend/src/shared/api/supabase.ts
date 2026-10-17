import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { REMEMBER_STORAGE_KEY } from "@/shared/api/remember";
import { env } from "@/shared/config/env";
import type { Database } from "@/shared/types/database.types";

/**
 * Session storage with defensive checks for environments without window storage.
 * The session lives in localStorage when the person chose "Keep me signed in" (the default),
 * and in sessionStorage when they did not, so it ends with the browser tab.
 */
function stores(): { primary: Storage | null; other: Storage | null } {
  if (typeof window === "undefined") return { primary: null, other: null };
  try {
    const keep = window.localStorage.getItem(REMEMBER_STORAGE_KEY) !== "0";
    return keep
      ? { primary: window.localStorage, other: window.sessionStorage }
      : { primary: window.sessionStorage, other: window.localStorage };
  } catch {
    return { primary: null, other: null };
  }
}

const customStorage = {
  getItem: (key: string): string | null => {
    const { primary, other } = stores();
    try {
      return primary?.getItem(key) ?? other?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    const { primary, other } = stores();
    try {
      primary?.setItem(key, value);
      other?.removeItem(key);
    } catch {
      // Ignore quota exceeded or storage blocked errors
    }
  },
  removeItem: (key: string): void => {
    const { primary, other } = stores();
    try {
      primary?.removeItem(key);
      other?.removeItem(key);
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
