/**
 * Small promise cache with a time-to-live. Concurrent callers share one
 * in-flight request, and failed loads are not cached.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: Promise<V>; expires: number; loadedAt: number }>();

  constructor(private readonly ttlMs: number, private readonly maxEntries = 300) {}

  get(key: string, loader: () => Promise<V>): Promise<V> {
    const now = Date.now();
    const existing = this.entries.get(key);
    if (existing && existing.expires > now) return existing.value;

    const value = loader();
    this.entries.set(key, { value, expires: now + this.ttlMs, loadedAt: now });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return value;
  }

  /** Seconds since the cached value for key was loaded, if cached and fresh. */
  ageSeconds(key: string): number | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.expires <= Date.now()) return undefined;
    return Math.round((Date.now() - entry.loadedAt) / 1000);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
