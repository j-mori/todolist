/**
 * Configuration loaded from the process environment.
 *
 * No defaults are silently applied for production-relevant values: the
 * loader either parses what's present or refuses to start. Dev defaults
 * live in `.env.example` and are explicit when they apply.
 */
export type Config = {
  port: number;
  databasePath: string;
  corsOrigin: string | string[];
  maxBodyBytes: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  /** When true, requests sent to the proxy are trusted as the public origin. */
  nodeEnv: 'development' | 'production' | 'test';
};

const LOG_LEVELS: ReadonlySet<Config['logLevel']> = new Set([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
]);

const NODE_ENVS: ReadonlySet<Config['nodeEnv']> = new Set(['development', 'production', 'test']);

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

class ConfigError extends Error {
  constructor(message: string) {
    super(`config: ${message}`);
    this.name = 'ConfigError';
  }
}

const requireString = (env: NodeJS.ProcessEnv, key: string): string => {
  const v = env[key];
  if (v === undefined || v === '') throw new ConfigError(`${key} is required`);
  return v;
};

const parsePort = (raw: string): number => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65_535) {
    throw new ConfigError(`PORT must be an integer in [1, 65535], got "${raw}"`);
  }
  return n;
};

const parsePositiveInt = (raw: string, key: string): number => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ConfigError(`${key} must be a positive integer, got "${raw}"`);
  }
  return n;
};

const parseCorsOrigin = (raw: string): string | string[] => {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) throw new ConfigError('CORS_ORIGIN must list at least one origin');
  return parts.length === 1 ? (parts[0] as string) : parts;
};

const parseLogLevel = (raw: string): Config['logLevel'] => {
  if (!LOG_LEVELS.has(raw as Config['logLevel'])) {
    throw new ConfigError(`LOG_LEVEL must be one of ${[...LOG_LEVELS].join('|')}, got "${raw}"`);
  }
  return raw as Config['logLevel'];
};

const parseNodeEnv = (raw: string): Config['nodeEnv'] => {
  if (!NODE_ENVS.has(raw as Config['nodeEnv'])) {
    throw new ConfigError(`NODE_ENV must be one of ${[...NODE_ENVS].join('|')}, got "${raw}"`);
  }
  return raw as Config['nodeEnv'];
};

/**
 * Parse and validate environment-driven configuration. Throws `ConfigError`
 * with a precise message naming any missing or malformed variable.
 *
 * Required: PORT, DATABASE_PATH, CORS_ORIGIN.
 * Optional: MAX_BODY_BYTES (default 65536), LOG_LEVEL (default info),
 * NODE_ENV (default production).
 */
export const loadConfig = (env: NodeJS.ProcessEnv): Config => ({
  port: parsePort(requireString(env, 'PORT')),
  databasePath: requireString(env, 'DATABASE_PATH'),
  corsOrigin: parseCorsOrigin(requireString(env, 'CORS_ORIGIN')),
  maxBodyBytes:
    env.MAX_BODY_BYTES !== undefined && env.MAX_BODY_BYTES !== ''
      ? parsePositiveInt(env.MAX_BODY_BYTES, 'MAX_BODY_BYTES')
      : DEFAULT_MAX_BODY_BYTES,
  logLevel: parseLogLevel(env.LOG_LEVEL ?? 'info'),
  nodeEnv: parseNodeEnv(env.NODE_ENV ?? 'production'),
});
