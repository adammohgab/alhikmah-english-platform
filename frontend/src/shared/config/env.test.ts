import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("Environment Configuration Schema", () => {
  const envSchema = z.object({
    VITE_APP_ENV: z.enum(["local", "staging", "production"]),
    VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL must be a valid URL"),
    VITE_SUPABASE_ANON_KEY: z.string().min(1, "VITE_SUPABASE_ANON_KEY is required"),
    VITE_ENABLE_MOCKS: z
      .string()
      .optional()
      .transform((val) => val === "true" || val === "1"),
    VITE_APP_VERSION: z.string().optional().default("0.1.0"),
  });

  it("validates compliant environment parameters", () => {
    const raw = {
      VITE_APP_ENV: "local",
      VITE_SUPABASE_URL: "https://xyzcompany.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key-token-abc",
      VITE_ENABLE_MOCKS: "true",
      VITE_APP_VERSION: "1.0.0",
    };

    const parsed = envSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.VITE_ENABLE_MOCKS).toBe(true);
      expect(parsed.data.VITE_APP_ENV).toBe("local");
    }
  });

  it("fails when VITE_SUPABASE_URL is invalid or missing", () => {
    const raw = {
      VITE_APP_ENV: "local",
      VITE_SUPABASE_URL: "not-a-url",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    };

    const parsed = envSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it("fails when VITE_SUPABASE_ANON_KEY is missing", () => {
    const raw = {
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: "https://xyzcompany.supabase.co",
    };

    const parsed = envSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it("fails when VITE_APP_ENV has an invalid enum value", () => {
    const raw = {
      VITE_APP_ENV: "qa",
      VITE_SUPABASE_URL: "https://xyzcompany.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    };

    const parsed = envSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });
});
