import { z } from "zod";

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

export type Env = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse(import.meta.env);

export const env: Env = (() => {
  if (parsedEnv.success) return parsedEnv.data;
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.warn(
    `[Env Warning] Invalid environment configuration, using fallbacks:\n${formattedErrors}`,
  );
  return {
    VITE_APP_ENV: "local",
    VITE_SUPABASE_URL: "https://placeholder-project-ref.supabase.co",
    VITE_SUPABASE_ANON_KEY: "placeholder-anon-key",
    VITE_ENABLE_MOCKS: true,
    VITE_APP_VERSION: "0.1.0",
  };
})();
