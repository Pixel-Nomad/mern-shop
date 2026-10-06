import "dotenv/config";
import { z } from "zod";

/**
 * Runtime environment schema.
 * Zod parses & validates process.env at startup.
 * If anything is missing/malformed, the process exits before
 * the app even tries to connect to the database.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  API_URL: z.string().url().default("http://localhost:5000"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be ≥32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be ≥32 chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
});

/**
 * Env type — inferred FROM the schema.
 * This is the single source of truth for what config exists.
 */
export type Env = z.infer<typeof envSchema>;
//             ▲ ▲ ▲ ▲ ▲ ▲ ▲
//             │ │ │ │ │ │ └── the schema value
//             │ │ │ │ │ └──── "give me the TS type of this"
//             │ │ │ │ └────── z.infer is generic: takes a Zod schema type, returns a TS type
//             │ │ │ └──────── the function call has type parameters *inside* the argument
//             │ │ └────────── (you don't write them — TS infers from schema)

/**
 * Parse & validate at module load.
 * If validation fails, we throw with a readable message
 * and the process exits (fail-fast — better than a mysterious
 * "MONGODB_URI is undefined" crash 30 seconds later).
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env: Env = parsed.data;
