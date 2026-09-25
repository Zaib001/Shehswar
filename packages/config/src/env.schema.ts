/**
 * SHEHSWAR ONE360 - Environment Configuration Schema with Zod Validation
 */
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_NAME: z.string().default('shehswar-one360'),

  // Database (PostgreSQL)
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:postgres@localhost:5432/shehswar_one360?schema=public'),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),

  // Cache & Background Queue (Redis)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().default(0),

  // Authentication & Cryptography
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default('shehswar_enterprise_jwt_access_super_secret_key_2026'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32)
    .default('shehswar_enterprise_jwt_refresh_super_secret_key_2026'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  PASSWORD_SALT_ROUNDS: z.coerce.number().default(12),

  // Storage Abstraction (S3 / Cloudflare R2 / MinIO / Local)
  STORAGE_PROVIDER: z.enum(['s3', 'r2', 'minio', 'local']).default('local'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_BUCKET: z.string().default('shehswar-documents'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_ACCESS_KEY: z.string().optional().default(''),
  STORAGE_SECRET_KEY: z.string().optional().default(''),
  STORAGE_LOCAL_ROOT: z.string().default('./uploads'),

  // Logging & Observability
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ENABLE_PRETTY_LOG: z.coerce.boolean().default(true),

  // CORS & Security
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_TTL: z.coerce.number().default(60),
  RATE_LIMIT_LIMIT: z.coerce.number().default(100),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown> = process.env): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(
      `Environment configuration validation error: ${JSON.stringify(formatted, null, 2)}`,
    );
  }

  return result.data;
}
