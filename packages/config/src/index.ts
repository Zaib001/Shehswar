/**
 * SHEHSWAR ONE360 - Configuration Barrel Export
 */
import { config as dotenvConfig } from 'dotenv';
import { validateEnv, EnvConfig } from './env.schema.js';

// Auto-load .env when imported if not in test/production environment
dotenvConfig();

let cachedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = validateEnv(process.env);
  }
  return cachedConfig;
}

export * from './env.schema.js';
