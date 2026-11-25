import { type RequestInit, type Response } from "undici";
export declare class FmrHttpError extends Error {
    readonly status?: number | undefined;
    readonly body?: string | undefined;
    constructor(message: string, status?: number | undefined, body?: string | undefined);
}
export interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: RequestInit["body"];
    timeoutMs?: number;
    /** Overrides the default retry count. Non-idempotent methods default to 0. */
    retries?: number;
}
export interface HttpOptions {
    timeoutMs: number;
    retries: number;
    proxyUrl?: string;
    /** Base delay between retries (ms). */
    retryDelayMs?: number;
}
/**
 * fetch wrapper with per-attempt timeout, retry with backoff for idempotent
 * requests, and corporate-proxy support (Node's built-in fetch ignores
 * HTTPS_PROXY on its own).
 */
export declare class HttpClient {
    private readonly options;
    readonly proxy?: string;
    private readonly dispatcher;
    constructor(options: HttpOptions, env?: NodeJS.ProcessEnv);
    request(url: string, options?: RequestOptions): Promise<Response>;
}
export declare function ensureOk(response: Response, url: string): Promise<Response>;
