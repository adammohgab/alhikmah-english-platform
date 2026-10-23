import { z } from "zod";

const envSchema = z.object({
  VITE_APP_ENV: z.enum(["local", "staging", "production"]),
  VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL must be a valid URL"),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, "VITE_SUPABASE_ANON_KEY is required"),
  VITE_ENABLE_MOCKS: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val === "true" || val === "1"),
  VITE_APP_VERSION: z.string().optional().default("0.1.0"),
});

export type Env = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse(import.meta.env);
const isProductionBuild =
  import.meta.env.MODE === "production" || import.meta.env.VITE_APP_ENV === "production";

export const env: Env = (() => {
  if (!parsedEnv.success) {
    const formattedErrors = parsedEnv.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    if (isProductionBuild) {
      throw new Error(`[Env Error] Invalid production environment configuration:\n${formattedErrors}`);
    }

    console.warn(
      `[Env Warning] Invalid environment configuration, using local fallbacks:\n${formattedErrors}`,
    );
    return {
      VITE_APP_ENV: "local",
      VITE_SUPABASE_URL: "https://placeholder-project-ref.supabase.co",
      VITE_SUPABASE_ANON_KEY: "placeholder-anon-key",
      VITE_ENABLE_MOCKS: true,
      VITE_APP_VERSION: "0.1.0",
    };
  }

  const parsed = parsedEnv.data;
  const hasPlaceholderConfig =
    parsed.VITE_SUPABASE_URL.includes("placeholder-project-ref") ||
    parsed.VITE_SUPABASE_ANON_KEY === "placeholder-anon-key";

  if (isProductionBuild && (hasPlaceholderConfig || parsed.VITE_ENABLE_MOCKS)) {
    throw new Error(
      "[Env Error] Production requires the real Supabase configuration and VITE_ENABLE_MOCKS=false.",
    );
  }

  return parsed;
})();
