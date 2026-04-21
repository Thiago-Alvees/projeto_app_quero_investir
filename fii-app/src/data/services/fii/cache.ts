import AsyncStorage from "@react-native-async-storage/async-storage";

type CacheEntry<T> = {
  savedAt: number;
  data: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

export async function readCache<T>(key: string, ttlMs: number): Promise<T | null> {
  const now = Date.now();
  const mem = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (mem && now - mem.savedAt <= ttlMs) return mem.data;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (now - parsed.savedAt > ttlMs) return null;

    memoryCache.set(key, parsed as CacheEntry<unknown>);
    return parsed.data;
  } catch {
    return null;
  }
}

// Used as a safety net when remote snapshots fail. Prefer readCache() for normal reads.
export async function readCacheAnyAge<T>(key: string): Promise<T | null> {
  const mem = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (mem) return mem.data;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;

    memoryCache.set(key, parsed as CacheEntry<unknown>);
    return parsed.data;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { savedAt: Date.now(), data };
  memoryCache.set(key, entry as CacheEntry<unknown>);

  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore cache write failures
  }
}
