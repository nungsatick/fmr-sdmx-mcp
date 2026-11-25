import path from "node:path";
function numberFromEnv(env, name, fallback, options = {}) {
    const raw = env[name];
    if (raw === undefined || raw.trim() === "")
        return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value))
        throw new Error(`${name} must be a number, got "${raw}".`);
    if (options.integer && !Number.isInteger(value))
        throw new Error(`${name} must be an integer, got "${raw}".`);
    if (options.min !== undefined && value < options.min)
        throw new Error(`${name} must be >= ${options.min}.`);
    if (options.max !== undefined && value > options.max)
        throw new Error(`${name} must be <= ${options.max}.`);
    return value;
}
export function splitRoots(value) {
    if (!value)
        return undefined;
    // ';' is the documented separator. On POSIX, ':' (path.delimiter) is accepted too.
    const separators = path.delimiter === ";" ? /;/ : /[;:]/;
    const roots = value.split(separators).map((root) => root.trim()).filter(Boolean);
    return roots.length ? roots : undefined;
}
export function defaultConfig(overrides = {}) {
    const config = {
        baseUrl: "https://fmr-sdmx.nso.go.th/fmr",
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
export function configFromEnv(env = process.env) {
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
    });
}
//# sourceMappingURL=config.js.map