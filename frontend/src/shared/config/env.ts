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

const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`[Env Validation Error] Invalid environment configuration:\n${formattedErrors}`);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof envSchema>;
