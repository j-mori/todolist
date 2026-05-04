/**
 * Resolves the API base URL the FE will append paths to. Defaults to `/api`,
 * which the Vite dev proxy and the production nginx proxy both forward to the
 * backend (ADR-0023). Override at build time with VITE_API_BASE_URL.
 */
const DEFAULT_API_BASE_URL = '/api';

export const getApiBaseUrl = (): string => {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return DEFAULT_API_BASE_URL;
};
