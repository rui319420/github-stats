import { getLanguageStats, type LanguageStats } from "./githubLanguages";
import { ApiError } from "./apiError";

interface CacheEntry {
  promise: Promise<LanguageStats>;
  expiresAt: number;
  settled: boolean;
}

const MAX_ENTRIES = 100;
const CACHE_TTL_MS = 300_000;
const cache = new Map<string, CacheEntry>();

export function getPublicLanguageStats(username: string): Promise<LanguageStats> {
  const key = username.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  cache.delete(key);
  for (const [entryKey, entry] of cache) {
    if (entry.expiresAt <= Date.now()) cache.delete(entryKey);
  }
  if (cache.size >= MAX_ENTRIES) {
    const oldest = [...cache].find(([, entry]) => entry.settled);
    if (!oldest) throw new ApiError("現在集計が混み合っています。再試行してください。", 429, 5);
    cache.delete(oldest[0]);
  }

  // JSON preview and SVG requests share one successful public aggregation.
  // Private credentials/results never enter this cache.
  const entry: CacheEntry = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    settled: false,
    promise: getLanguageStats(username, false),
  };
  cache.set(key, entry);
  entry.promise = entry.promise.then((stats) => {
    entry.expiresAt = Date.now() + CACHE_TTL_MS;
    entry.settled = true;
    return stats;
  }, (error: unknown) => {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  });
  return entry.promise;
}
