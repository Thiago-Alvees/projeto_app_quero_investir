import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "fii:favorites";

let memoryCache: Set<string> | null = null;

function normalize(ticker: string) {
  return ticker.toUpperCase().trim();
}

async function readFavorites(): Promise<Set<string>> {
  if (memoryCache) return new Set(memoryCache);

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryCache = new Set();
      return new Set();
    }

    const parsed = JSON.parse(raw) as string[];
    const set = new Set((parsed ?? []).map((item) => normalize(item)));
    memoryCache = new Set(set);
    return set;
  } catch {
    memoryCache = new Set();
    return new Set();
  }
}

async function writeFavorites(set: Set<string>): Promise<void> {
  memoryCache = new Set(set);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore storage errors
  }
}

export async function getFavorites(): Promise<string[]> {
  const set = await readFavorites();
  return Array.from(set).sort();
}

export async function isFavorite(ticker: string): Promise<boolean> {
  const set = await readFavorites();
  return set.has(normalize(ticker));
}

export async function toggleFavorite(ticker: string): Promise<boolean> {
  const set = await readFavorites();
  const key = normalize(ticker);

  if (set.has(key)) {
    set.delete(key);
  } else {
    set.add(key);
  }

  await writeFavorites(set);
  return set.has(key);
}
