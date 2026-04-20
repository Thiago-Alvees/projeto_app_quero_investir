import type { MarketAsset, MarketAssetClass } from "../../domain/models/marketAsset";
import { MARKET_ASSETS_MOCK } from "../mock/marketAssets";
import { toUpper } from "./fii/utils";
import { MARKET_FUNDAMENTALS_URL, MARKET_SNAPSHOT_URL } from "./market/config";

export type MarketDataSource = "SNAPSHOT" | "MOCK";

export type MarketListResult =
  | {
      ok: true;
      data: MarketAsset[];
      source: MarketDataSource;
      updatedAt: string | null;
      priceUpdatedAtByTicker: Record<string, string>;
    }
  | { ok: false; message: string };

type MarketSnapshotItem = {
  ticker?: string;
  assetClass?: MarketAssetClass;
  price?: number;
  priceUpdatedAt?: string | null;
};

type MarketSnapshotPayload = {
  generatedAt?: string | null;
  provider?: string;
  items?: MarketSnapshotItem[];
};

type MarketFundamentalsItem = {
  ticker?: string;
  assetClass?: MarketAssetClass;
  name?: string;
  category?: string;
  pvp?: number;
  pl?: number;
  dividendYield12m?: number;
  expenseRatio?: number;
  expectedAnnualReturn?: number;
};

type MarketFundamentalsPayload = {
  generatedAt?: string | null;
  provider?: string;
  items?: MarketFundamentalsItem[];
};

const CACHE_TTL_MS = 1000 * 60 * 15;
let memoryCache:
  | {
      savedAt: number;
      payload: {
        data: MarketAsset[];
        source: MarketDataSource;
        updatedAt: string | null;
        priceUpdatedAtByTicker: Record<string, string>;
      };
    }
  | null = null;

function toPositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getLatestDate(...values: Array<string | null | undefined>): string | null {
  let latestMs = 0;

  for (const value of values) {
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (Number.isFinite(ms) && ms > latestMs) {
      latestMs = ms;
    }
  }

  return latestMs > 0 ? new Date(latestMs).toISOString() : null;
}

async function fetchSnapshot(): Promise<MarketSnapshotPayload | null> {
  const response = await fetch(MARKET_SNAPSHOT_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = (await response.json()) as MarketSnapshotPayload;
  return payload && Array.isArray(payload.items) ? payload : null;
}

async function fetchFundamentals(): Promise<MarketFundamentalsPayload | null> {
  const response = await fetch(MARKET_FUNDAMENTALS_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = (await response.json()) as MarketFundamentalsPayload;
  return payload && Array.isArray(payload.items) ? payload : null;
}

export async function getMarketAssets(options: { force: boolean }): Promise<MarketListResult> {
  if (!options.force && memoryCache && Date.now() - memoryCache.savedAt <= CACHE_TTL_MS) {
    return {
      ok: true,
      data: memoryCache.payload.data,
      source: memoryCache.payload.source,
      updatedAt: memoryCache.payload.updatedAt,
      priceUpdatedAtByTicker: memoryCache.payload.priceUpdatedAtByTicker,
    };
  }

  const base = MARKET_ASSETS_MOCK.map((item) => ({ ...item }));
  const baseByKey = new Map(base.map((item) => [`${item.assetClass}:${toUpper(item.ticker)}`, item]));

  let snapshot: MarketSnapshotPayload | null = null;
  let fundamentals: MarketFundamentalsPayload | null = null;

  try {
    [snapshot, fundamentals] = await Promise.all([
      fetchSnapshot().catch((error) => {
        if (__DEV__) console.log("[market] snapshot remoto indisponivel:", String(error));
        return null;
      }),
      fetchFundamentals().catch((error) => {
        if (__DEV__) console.log("[market] fundamentos remotos indisponiveis:", String(error));
        return null;
      }),
    ]);
  } catch (error) {
    if (__DEV__) console.log("[market] falha inesperada:", String(error));
  }

  const snapshotByKey = new Map<string, MarketSnapshotItem>();
  const fundamentalsByKey = new Map<string, MarketFundamentalsItem>();
  const priceUpdatedAtByTicker: Record<string, string> = {};

  for (const item of snapshot?.items ?? []) {
    const ticker = toUpper(item.ticker ?? "");
    if (!ticker) continue;
    const assetClass = item.assetClass;
    if (assetClass !== "STOCK" && assetClass !== "ETF") continue;

    const key = `${assetClass}:${ticker}`;
    snapshotByKey.set(key, item);

    const priceUpdatedAt = toIsoString(item.priceUpdatedAt) ?? toIsoString(snapshot?.generatedAt);
    if (priceUpdatedAt) {
      priceUpdatedAtByTicker[ticker] = priceUpdatedAt;
    }
  }

  for (const item of fundamentals?.items ?? []) {
    const ticker = toUpper(item.ticker ?? "");
    if (!ticker) continue;
    const assetClass = item.assetClass;
    if (assetClass !== "STOCK" && assetClass !== "ETF") continue;
    fundamentalsByKey.set(`${assetClass}:${ticker}`, item);
  }

  const merged = base.map((item) => {
    const key = `${item.assetClass}:${toUpper(item.ticker)}`;
    const snapshotItem = snapshotByKey.get(key);
    const fundamentalsItem = fundamentalsByKey.get(key);
    const ticker = toUpper(item.ticker);

    return {
      ticker: item.ticker,
      assetClass: item.assetClass,
      name: fundamentalsItem?.name?.trim() || item.name,
      category: fundamentalsItem?.category?.trim() || item.category,
      price: toPositiveNumber(snapshotItem?.price) ?? item.price,
      priceUpdatedAt:
        toIsoString(snapshotItem?.priceUpdatedAt) ??
        priceUpdatedAtByTicker[ticker] ??
        toIsoString(snapshot?.generatedAt),
      pvp: toFiniteNumber(fundamentalsItem?.pvp) ?? item.pvp,
      pl: toFiniteNumber(fundamentalsItem?.pl) ?? item.pl,
      dividendYield12m:
        toFiniteNumber(fundamentalsItem?.dividendYield12m) ?? item.dividendYield12m,
      expenseRatio: toFiniteNumber(fundamentalsItem?.expenseRatio) ?? item.expenseRatio,
      expectedAnnualReturn:
        toPositiveNumber(fundamentalsItem?.expectedAnnualReturn) ?? item.expectedAnnualReturn,
    } satisfies MarketAsset;
  });

  for (const [key, item] of fundamentalsByKey) {
    if (baseByKey.has(key)) continue;
    if (!item.ticker || !item.assetClass || !item.name || !item.category) continue;

    const snapshotItem = snapshotByKey.get(key);
    const ticker = toUpper(item.ticker);
    merged.push({
      ticker,
      assetClass: item.assetClass,
      name: item.name,
      category: item.category,
      price: toPositiveNumber(snapshotItem?.price) ?? 0,
      priceUpdatedAt:
        toIsoString(snapshotItem?.priceUpdatedAt) ??
        priceUpdatedAtByTicker[ticker] ??
        toIsoString(snapshot?.generatedAt),
      pvp: toFiniteNumber(item.pvp),
      pl: toFiniteNumber(item.pl),
      dividendYield12m: toFiniteNumber(item.dividendYield12m),
      expenseRatio: toFiniteNumber(item.expenseRatio),
      expectedAnnualReturn: toPositiveNumber(item.expectedAnnualReturn) ?? 0,
    });
  }

  const source: MarketDataSource =
    snapshotByKey.size > 0 || fundamentalsByKey.size > 0 ? "SNAPSHOT" : "MOCK";
  const updatedAt = getLatestDate(snapshot?.generatedAt, fundamentals?.generatedAt);
  const payload = {
    data: merged,
    source,
    updatedAt,
    priceUpdatedAtByTicker,
  };

  memoryCache = {
    savedAt: Date.now(),
    payload,
  };

  return {
    ok: true,
    data: payload.data,
    source: payload.source,
    updatedAt: payload.updatedAt,
    priceUpdatedAtByTicker: payload.priceUpdatedAtByTicker,
  };
}
