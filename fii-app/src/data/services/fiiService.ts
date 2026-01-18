// src/data/services/fiiService.ts

import type { Fii } from "../../domain/models/fii";
import { FIIS_MOCK } from "../mock/fiis";
import Constants from "expo-constants";

export type DataSource = "LIVE" | "MOCK";

export type Result<T> =
  | { ok: true; data: T; source: DataSource }
  | { ok: false; message: string };

export function isOk<T>(r: Result<T>): r is { ok: true; data: T; source: DataSource } {
  return r.ok === true;
}

type PriceMap = Record<string, number>;

function normalizeSymbol(symbol: string) {
  return symbol.toUpperCase().replace(".SA", "").trim();
}

function getBrapiToken(): string | undefined {
  const token = Constants.expoConfig?.extra?.BRAPI_TOKEN as string | undefined;
  return token?.trim() ? token : undefined;
}

/**
 * Cache em memória para reduzir chamadas e mitigar rate limit (429)
 * TTL: 5 minutos
 */
let priceCache: { data: PriceMap; fetchedAt: number } | null = null;
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Circuit breaker: se receber 429, entra em cooldown e não tenta API por um tempo
 */
let brapiBlockedUntil = 0;
const BRAPI_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos

async function fetchPrices(tickers: string[]): Promise<PriceMap> {
  const token = getBrapiToken();
  if (!token) {
    throw new Error("Token BRAPI não configurado (verifique .env e app.config.js)");
  }

  const now = Date.now();

  // Circuit breaker: se estamos em cooldown, nem tenta a API
  if (now < brapiBlockedUntil) {
    if (__DEV__) console.log("[brapi] em cooldown (429). Pulando chamada.");
    throw new Error("BRAPI_COOLDOWN");
  }

  // Cache TTL: se já temos cache recente, usa e evita nova chamada
  if (priceCache && now - priceCache.fetchedAt < PRICE_CACHE_TTL_MS) {
    if (__DEV__) console.log("[brapi] usando cache (TTL)");
    return priceCache.data;
  }

  const baseTickers = tickers.map((t) => t.toUpperCase().trim());

  // Tentativa 1: sem .SA
  const symbols1 = baseTickers.join(",");
  const url1 =
    `https://brapi.dev/api/quote/${encodeURIComponent(symbols1)}` +
    `?range=1d&interval=1d&token=${encodeURIComponent(token)}`;

  // Tentativa 2: com .SA
  const symbols2 = baseTickers.map((t) => `${t}.SA`).join(",");
  const url2 =
    `https://brapi.dev/api/quote/${encodeURIComponent(symbols2)}` +
    `?range=1d&interval=1d&token=${encodeURIComponent(token)}`;

  async function run(url: string) {
    const res = await fetch(url);

    if (!res.ok) {
      if (res.status === 429) throw new Error("HTTP 429");
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    const raw = json?.results;
    const results = Array.isArray(raw) ? raw : [];

    const map: PriceMap = {};
    for (const r of results) {
      const sym = normalizeSymbol(String(r?.symbol ?? ""));
      const price = Number(r?.regularMarketPrice);
      if (sym && Number.isFinite(price)) {
        map[sym] = price;
      }
    }

    if (__DEV__) {
      console.log("[brapi] url:", url);
      console.log(
        "[brapi] results:",
        results.map((x: any) => ({
          symbol: x?.symbol,
          price: x?.regularMarketPrice,
        }))
      );
      console.log("[brapi] map:", map);
    }

    return map;
  }

  // Tentativa 1
  try {
    const m1 = await run(url1);
    if (Object.keys(m1).length > 0) {
      priceCache = { data: m1, fetchedAt: Date.now() };
      return m1;
    }
  } catch (e) {
    const msg = String(e);
    if (__DEV__) console.log("[brapi] tentativa 1 falhou:", msg);

    if (msg.includes("HTTP 429")) {
      brapiBlockedUntil = Date.now() + BRAPI_COOLDOWN_MS;
      if (__DEV__) console.log("[brapi] 429 recebido. Cooldown ativado (10 min).");
      throw e;
    }
  }

  // Tentativa 2
  try {
    const m2 = await run(url2);
    priceCache = { data: m2, fetchedAt: Date.now() };
    return m2;
  } catch (e) {
    const msg = String(e);
    if (__DEV__) console.log("[brapi] tentativa 2 falhou:", msg);

    if (msg.includes("HTTP 429")) {
      brapiBlockedUntil = Date.now() + BRAPI_COOLDOWN_MS;
      if (__DEV__) console.log("[brapi] 429 recebido. Cooldown ativado (10 min).");
    }
    throw e;
  }
}

export async function getFiiList(): Promise<Result<Fii[]>> {
  try {
    const base = FIIS_MOCK;
    const tickers = base.map((x) => x.ticker.toUpperCase());

    let prices: PriceMap = {};
    let source: DataSource = "MOCK";

    try {
      prices = await fetchPrices(tickers);
      source = Object.keys(prices).length > 0 ? "LIVE" : "MOCK";
      if (__DEV__) console.log("[brapi] preços obtidos:", Object.keys(prices).length);
    } catch (e) {
      prices = {};
      source = "MOCK";
      const msg = String(e);

      if (msg.includes("HTTP 429") || msg.includes("BRAPI_COOLDOWN")) {
        if (__DEV__) console.log("[brapi] rate limit/cooldown ativo. Mantendo MOCK.");
      } else {
        if (__DEV__) console.log("[brapi] falhou. Mantendo MOCK:", msg);
      }
    }

    const merged: Fii[] = base.map((x) => ({
      ...x,
      price: prices[x.ticker.toUpperCase()] ?? x.price,
    }));

    return { ok: true, data: merged, source };
  } catch {
    return { ok: false, message: "Não foi possível carregar os dados agora. Tente novamente." };
  }
}

export async function getFiiByTicker(ticker: string): Promise<Result<Fii>> {
  try {
    const base = FIIS_MOCK.find(
      (x) => x.ticker.toUpperCase() === ticker.toUpperCase()
    );
    if (!base) return { ok: false, message: "FII não encontrado." };

    let price = base.price;
    let source: DataSource = "MOCK";

    try {
      const prices = await fetchPrices([base.ticker.toUpperCase()]);
      const updated = prices[base.ticker.toUpperCase()];
      if (typeof updated === "number" && Number.isFinite(updated)) {
        price = updated;
        source = "LIVE";
      }
    } catch (e) {
      source = "MOCK";
      if (__DEV__) console.log("[brapi] detalhe falhou. Mantendo MOCK:", String(e));
    }

    return { ok: true, data: { ...base, price }, source };
  } catch {
    return { ok: false, message: "Não foi possível carregar este FII agora. Tente novamente." };
  }
}
