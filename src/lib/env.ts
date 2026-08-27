import { z } from "zod";

const envSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  COOKIE_NAME: z.string().default("elemeentra_session"),

  ADMIN_PATH: z
    .string()
    .min(6, "ADMIN_PATH must be a non-guessable secret segment")
    .regex(/^[a-z0-9-]+$/, "ADMIN_PATH may only contain lowercase letters, numbers, and hyphens"),

  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Validates and returns process.env against the schema above.
 * Called lazily (not at module load) so it only runs server-side,
 * and throws a readable error instead of undefined-related bugs downstream.
 */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables. Check .env.local against .env.example:\n${issues}`
    );
  }

  cached = parsed.data;
  return cached;
}
