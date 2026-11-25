import { Agent, EnvHttpProxyAgent, ProxyAgent, fetch, } from "undici";
export class FmrHttpError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = "FmrHttpError";
    }
}
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
function maskCredentials(url) {
    try {
        const parsed = new URL(url);
        if (parsed.username || parsed.password) {
            parsed.username = "***";
            parsed.password = "";
        }
        return parsed.toString();
    }
    catch {
        return "(unparseable proxy URL)";
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isTimeout(error) {
    const err = error;
    return err?.name === "TimeoutError" || err?.cause?.name === "TimeoutError"
        || err?.name === "AbortError" || err?.cause?.name === "AbortError";
}
function describeCause(error) {
    const err = error;
    return err?.cause?.code ?? err?.cause?.message ?? err?.message ?? String(error);
}
function retryAfterMs(response) {
    const header = response.headers.get("retry-after");
    if (!header)
        return undefined;
    const seconds = Number(header);
    if (Number.isFinite(seconds))
        return Math.min(seconds * 1000, 30_000);
    const date = Date.parse(header);
    return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 30_000)) : undefined;
}
/**
 * fetch wrapper with per-attempt timeout, retry with backoff for idempotent
 * requests, and corporate-proxy support (Node's built-in fetch ignores
 * HTTPS_PROXY on its own).
 */
export class HttpClient {
    options;
    proxy;
    dispatcher;
    constructor(options, env = process.env) {
        this.options = options;
        if (options.proxyUrl) {
            this.dispatcher = new ProxyAgent(options.proxyUrl);
            this.proxy = maskCredentials(options.proxyUrl);
        }
        else if (env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy) {
            this.dispatcher = new EnvHttpProxyAgent();
            this.proxy = maskCredentials(env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || "");
        }
        else {
            this.dispatcher = new Agent();
        }
    }
    async request(url, options = {}) {
        const method = (options.method ?? "GET").toUpperCase();
        const idempotent = method === "GET" || method === "HEAD";
        const maxRetries = options.retries ?? (idempotent ? this.options.retries : 0);
        const timeoutMs = options.timeoutMs ?? this.options.timeoutMs;
        const baseDelay = this.options.retryDelayMs ?? 500;
        for (let attempt = 0;; attempt += 1) {
            const backoff = baseDelay * 2 ** attempt + Math.floor(Math.random() * baseDelay);
            let response;
            try {
                response = await fetch(url, {
                    method,
                    headers: options.headers,
                    body: options.body,
                    dispatcher: this.dispatcher,
                    signal: AbortSignal.timeout(timeoutMs),
                });
            }
            catch (error) {
                if (attempt < maxRetries) {
                    await sleep(backoff);
                    continue;
                }
                if (isTimeout(error)) {
                    throw new FmrHttpError(`FMR request timed out after ${Math.round(timeoutMs / 1000)}s: ${method} ${url}`);
                }
                throw new FmrHttpError(`Could not reach FMR (${describeCause(error)}): ${method} ${url}. `
                    + "Check the network, or set HTTPS_PROXY / FMR_PROXY if this machine uses a proxy.");
            }
            if (RETRY_STATUSES.has(response.status) && attempt < maxRetries) {
                await response.body?.cancel().catch(() => undefined);
                await sleep(retryAfterMs(response) ?? backoff);
                continue;
            }
            return response;
        }
    }
}
export async function ensureOk(response, url) {
    if (response.ok)
        return response;
    const body = (await response.text().catch(() => "")).slice(0, 2000);
    throw new FmrHttpError(`FMR request failed (${response.status} ${response.statusText}) for ${url}${body ? `: ${body}` : ""}`, response.status, body);
}
//# sourceMappingURL=http.js.map