/**
 * Small promise cache with a time-to-live. Concurrent callers share one
 * in-flight request, and failed loads are not cached.
 */
export declare class TtlCache<V> {
    private readonly ttlMs;
    private readonly maxEntries;
    private readonly entries;
    constructor(ttlMs: number, maxEntries?: number);
    get(key: string, loader: () => Promise<V>): Promise<V>;
    /** Seconds since the cached value for key was loaded, if cached and fresh. */
    ageSeconds(key: string): number | undefined;
    clear(): void;
    get size(): number;
}
