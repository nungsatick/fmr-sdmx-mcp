import path from "node:path";

export interface FmrConfig {
  /** FMR application base URL, without trailing slash. */
  baseUrl: string;
  /** Absolute directories the tools may read from or write to. */
  allowedRoots: string[];
  maxFileBytes: number;
  username?: string;
  password?: string;
  /** Timeout for one ordinary HTTP request (ms). */
  timeoutMs: number;
  /** Timeout for an upload request (ms). */
  uploadTimeoutMs: number;
  /** Retries for idempotent requests on network errors, 429 and 502-504. */
  retries: number;
  /** Time-to-live of cached structural metadata (ms). 0 disables caching. */
  cacheTtlMs: number;
  /** FMR forgets an upload after about this much inactivity (ms). */
  sessionTtlMs: number;
  /** Preferred language for names, e.g. "th" or "en". */
  language: string;
  /** Explicit proxy URL. When unset, HTTPS_PROXY/HTTP_PROXY/NO_PROXY are honoured. */
  proxyUrl?: string;
  /** Largest tool response returned to the model, in characters. */
  maxResponseChars: number;
}

function numberFromEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number, got "${raw}".`);
  if (options.integer && !Number.isInteger(value)) throw new Error(`${name} must be an integer, got "${raw}".`);
  if (options.min !== undefined && value < options.min) throw new Error(`${name} must be >= ${options.min}.`);
  if (options.max !== undefined && value > options.max) throw new Error(`${name} must be <= ${options.max}.`);
  return value;
}

export function splitRoots(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  // ';' is the documented separator. On POSIX, ':' (path.delimiter) is accepted too.
  const separators = path.delimiter === ";" ? /;/ : /[;:]/;
  const roots = value.split(separators).map((root) => root.trim()).filter(Boolean);
  return roots.length ? roots : undefined;
}

export function defaultConfig(overrides: Partial<FmrConfig> = {}): FmrConfig {
  const config: FmrConfig = {
    baseUrl: "https://sdmx.nso.go.th/FusionMetadataRegistry",
    allowedRoots: [process.cwd()],
    maxFileBytes: 100 * 1024 * 1024,
    timeoutMs: 60_000,
    uploadTimeoutMs: 300_000,
    retries: 2,
    cacheTtlMs: 10 * 60_000,
    sessionTtlMs: 15 * 60_000,
    language: "th",
    maxResponseChars: 60_000,
    // Unset (undefined) overrides keep the defaults.
    ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)),
  };
  config.baseUrl = config.baseUrl.replace(/\/+$/, "");
  config.allowedRoots = config.allowedRoots.map((root) => path.resolve(root));
  return config;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): FmrConfig {
  const username = env.FMR_USERNAME || undefined;
  const password = env.FMR_PASSWORD || undefined;
  if ((username && !password) || (!username && password)) {
    throw new Error("Both FMR_USERNAME and FMR_PASSWORD must be set together.");
  }
  return defaultConfig({
    baseUrl: env.FMR_BASE_URL || undefined,
    allowedRoots: splitRoots(env.FMR_ALLOWED_ROOTS),
    maxFileBytes: numberFromEnv(env, "FMR_MAX_FILE_MB", 100, { min: 0.001 }) * 1024 * 1024,
    username,
    password,
    timeoutMs: numberFromEnv(env, "FMR_TIMEOUT_SECONDS", 60, { min: 1 }) * 1000,
    uploadTimeoutMs: numberFromEnv(env, "FMR_UPLOAD_TIMEOUT_SECONDS", 300, { min: 1 }) * 1000,
    retries: numberFromEnv(env, "FMR_RETRIES", 2, { min: 0, max: 10, integer: true }),
    cacheTtlMs: numberFromEnv(env, "FMR_CACHE_TTL_SECONDS", 600, { min: 0 }) * 1000,
    sessionTtlMs: numberFromEnv(env, "FMR_SESSION_TTL_MINUTES", 15, { min: 1 }) * 60_000,
    language: env.FMR_LANGUAGE || undefined,
    proxyUrl: env.FMR_PROXY || undefined,
    maxResponseChars: numberFromEnv(env, "FMR_MAX_RESPONSE_CHARS", 60_000, { min: 2000, integer: true }),
  } as Partial<FmrConfig>);
}
