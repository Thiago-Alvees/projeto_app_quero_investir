import type { MarketAsset } from "../../domain/models/marketAsset";
import { MARKET_ASSETS_MOCK } from "../mock/marketAssets";
import {
  getBrapiProxyUrl,
  getBrapiToken,
  normalizeBaseUrl,
  toUpper,
} from "./fii/utils";
import { BRAPI_BASE_URL } from "./fii/config";

export type MarketDataSource = "BRAPI" | "MOCK";

export type MarketListResult =
  | {
      ok: true;
      data: MarketAsset[];
      source: MarketDataSource;
      updatedAt: string | null;
      priceUpdatedAtByTicker: Record<string, string>;
    }
  | { ok: false; message: string };

type BrapiQuoteItem = {
  symbol?: string;
  regularMarketPrice?: number;
  price?: number;
  close?: number;
  regularMarketTime?: number;
  historicalDataPrice?: Array<{ date?: number | string; close?: number }>;
};

type BrapiQuoteResponse = {
  results?: BrapiQuoteItem[];
  error?: string;
  message?: string;
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

function getPriceFromQuote(item: BrapiQuoteItem): number | null {
  const direct =
    typeof item.regularMarketPrice === "number"
      ? item.regularMarketPrice
      : typeof item.price === "number"
        ? item.price
        : typeof item.close === "number"
          ? item.close
          : null;

  if (direct !== null && Number.isFinite(direct) && direct > 0) return direct;

  const fromHistory = item.historicalDataPrice?.[0]?.close;
  if (typeof fromHistory === "number" && Number.isFinite(fromHistory) && fromHistory > 0) {
    return fromHistory;
  }

  return null;
}

async function fetchLatestPrices(tickers: string[]): Promise<{
  priceMap: Map<string, number>;
  updatedAt: string | null;
  priceUpdatedAtByTicker: Record<string, string>;
}> {
  if (!tickers.length) {
    return { priceMap: new Map(), updatedAt: null, priceUpdatedAtByTicker: {} };
  }

  const token = getBrapiToken();
  const proxyUrl = getBrapiProxyUrl();
  const isProxy = Boolean(proxyUrl);
  const baseUrl = proxyUrl ? normalizeBaseUrl(proxyUrl) : BRAPI_BASE_URL;

  const symbolPath = tickers.map((ticker) => toUpper(ticker)).join(",");
  const query = [
    "range=1d",
    "interval=1d",
    !isProxy && token ? `token=${encodeURIComponent(token)}` : null,
  ]
    .filter(Boolean)
    .join("&");

  const url = `${baseUrl}/${symbolPath}?${query}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`BRAPI ${response.status}`);

  const payload = (await response.json()) as BrapiQuoteResponse;
  const results = Array.isArray(payload.results) ? payload.results : [];

  const priceMap = new Map<string, number>();
  const priceUpdatedAtByTicker: Record<string, string> = {};
  let updatedAt: string | null = null;

  for (const row of results) {
    const ticker = toUpper(row.symbol ?? "");
    if (!ticker) continue;

    const price = getPriceFromQuote(row);
    if (price !== null) {
      priceMap.set(ticker, price);
    }

    if (typeof row.regularMarketTime === "number" && Number.isFinite(row.regularMarketTime)) {
      const ms = row.regularMarketTime > 1e12 ? row.regularMarketTime : row.regularMarketTime * 1000;
      const iso = new Date(ms).toISOString();
      priceUpdatedAtByTicker[ticker] = iso;
      if (!updatedAt || ms > new Date(updatedAt).getTime()) {
        updatedAt = iso;
      }
    }
  }

  return { priceMap, updatedAt, priceUpdatedAtByTicker };
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
  const tickers = base.map((item) => item.ticker);

  try {
    const { priceMap, updatedAt, priceUpdatedAtByTicker } = await fetchLatestPrices(tickers);
    const merged = base.map((item) => {
      const tickerKey = toUpper(item.ticker);
      const latestPrice = priceMap.get(toUpper(item.ticker));
      const priceUpdatedAt = priceUpdatedAtByTicker[tickerKey] ?? updatedAt ?? null;
      if (typeof latestPrice === "number" && Number.isFinite(latestPrice) && latestPrice > 0) {
        return { ...item, price: latestPrice, priceUpdatedAt };
      }
      return { ...item, priceUpdatedAt };
    });

    memoryCache = {
      savedAt: Date.now(),
      payload: {
        data: merged,
        source: priceMap.size > 0 ? "BRAPI" : "MOCK",
        updatedAt: updatedAt ?? null,
        priceUpdatedAtByTicker,
      },
    };

    return {
      ok: true,
      data: merged,
      source: memoryCache.payload.source,
      updatedAt: memoryCache.payload.updatedAt,
      priceUpdatedAtByTicker: memoryCache.payload.priceUpdatedAtByTicker,
    };
  } catch (error) {
    if (__DEV__) console.log("[market] fallback para mock:", String(error));

    memoryCache = {
      savedAt: Date.now(),
      payload: {
        data: base.map((item) => ({ ...item, priceUpdatedAt: null })),
        source: "MOCK",
        updatedAt: null,
        priceUpdatedAtByTicker: {},
      },
    };

    return {
      ok: true,
      data: base.map((item) => ({ ...item, priceUpdatedAt: null })),
      source: "MOCK",
      updatedAt: null,
      priceUpdatedAtByTicker: {},
    };
  }
}
