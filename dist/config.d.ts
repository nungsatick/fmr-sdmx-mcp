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
export declare function splitRoots(value: string | undefined): string[] | undefined;
export declare function defaultConfig(overrides?: Partial<FmrConfig>): FmrConfig;
export declare function configFromEnv(env?: NodeJS.ProcessEnv): FmrConfig;
