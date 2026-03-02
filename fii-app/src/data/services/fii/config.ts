import type { Fundamentals } from "./types";

export const CACHE_TTL_LIST_MS = 1000 * 60 * 30;
export const CACHE_TTL_DETAIL_MS = 1000 * 60 * 60 * 6;
export const LIST_CACHE_KEY = "fii:list";
export const DETAIL_CACHE_PREFIX = "fii:detail:";

export const SNAPSHOT_URL =
  "https://raw.githubusercontent.com/Thiago-Alvees/app_snapshot/main/data/fiis_snapshot.json";

export const FUNDAMENTALS_URL =
  "https://raw.githubusercontent.com/Thiago-Alvees/app_snapshot/main/data/fiis_fundamentals.json";

export const BRAPI_BASE_URL = "https://brapi.dev/api/quote";

export function getLocalFundamentals(): Fundamentals | null {
  try {
    const json = require("../../static/fiis_fundamentals_cvm.json") as Fundamentals;
    if (!json || !Array.isArray(json.items)) return null;
    return json;
  } catch {
    return null;
  }
}
