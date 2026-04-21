import fs from "fs/promises";
import path from "path";

import { MARKET_UNIVERSE } from "./market-universe.mjs";

const BRAPI_BASE_URL = "https://brapi.dev/api/quote";
const MODULES = ["defaultKeyStatistics", "financialData"];
const DELAY_MS = 450;
const MAX_ATTEMPTS = 4;
const CONCURRENCY = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSymbol(symbol) {
  return String(symbol ?? "").toUpperCase().replace(".SA", "").trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizePercent(value, options = {}) {
  const { maxPercent = 100, allowZero = false } = options;
  const parsed = toNumber(value);
  if (parsed === null) return null;

  if (!allowZero && parsed === 0) return null;
  if (parsed < 0) return null;

  // Providers sometimes use decimals (0.08) instead of percents (8).
  const maybePercent = parsed <= 1.5 ? parsed * 100 : parsed;
  return maybePercent <= maxPercent ? maybePercent : null;
}

function normalizeRatio(value) {
  const parsed = toPositiveNumber(value);
  if (parsed === null) return null;
  if (parsed > 2000) return null;
  return parsed;
}

async function fetchJsonWithRetry(url, maxAttempts = MAX_ATTEMPTS) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.status === 404) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP 404 - ${text.slice(0, 200)}`);
      }

      // Auth / plan errors are not retryable.
      if (response.status === 401 || response.status === 403) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} - ${text.slice(0, 200)}`);
      }

      if (response.status === 429) {
        const wait = 1200 * attempt;
        console.log(`[market-fundamentals] HTTP 429. Retry ${attempt}/${maxAttempts} em ${wait}ms`);
        await sleep(wait);
        continue;
      }

      if (response.status >= 500 && response.status <= 599) {
        const wait = 800 * attempt;
        console.log(
          `[market-fundamentals] HTTP ${response.status}. Retry ${attempt}/${maxAttempts} em ${wait}ms`
        );
        await sleep(wait);
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} - ${text.slice(0, 200)}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      const message = String(error);
      if (message.includes("HTTP 404") || message.includes("HTTP 401") || message.includes("HTTP 403")) {
        throw error;
      }

      const wait = 800 * attempt;
      console.log(
        `[market-fundamentals] Erro: ${String(error)}. Retry ${attempt}/${maxAttempts} em ${wait}ms`
      );
      await sleep(wait);
    }
  }

  throw lastError ?? new Error("Falha desconhecida ao buscar fundamentos");
}

function extractExpenseRatioPercent(item) {
  // Try a few common keys from Yahoo/BRAPI modules.
  const candidates = [
    item?.defaultKeyStatistics?.annualReportExpenseRatio,
    item?.defaultKeyStatistics?.expenseRatio,
    item?.financialData?.totalExpenseRatio,
    item?.financialData?.expenseRatio,
  ];

  for (const candidate of candidates) {
    const parsed = toNumber(candidate);
    if (parsed === null) continue;

    // Some providers return 0.003 (0.3%), others 0.3 (0.3%).
    const percent = parsed <= 0.2 ? parsed * 100 : parsed;
    if (Number.isFinite(percent) && percent >= 0 && percent <= 5) return percent;
  }

  return null;
}

async function fetchFundamentalsForTicker(ticker, token) {
  const query = new URLSearchParams();
  query.set("modules", MODULES.join(","));
  // Keep response small. The base endpoint also returns regularMarketPrice.
  query.set("range", "1d");
  query.set("interval", "1d");
  if (token) query.set("token", token);

  const urls = [
    `${BRAPI_BASE_URL}/${encodeURIComponent(ticker)}?${query.toString()}`,
    `${BRAPI_BASE_URL}/${encodeURIComponent(`${ticker}.SA`)}?${query.toString()}`,
  ];

  for (const url of urls) {
    try {
      const json = await fetchJsonWithRetry(url);
      const results = Array.isArray(json?.results) ? json.results : [];
      for (const row of results) {
        const symbol = normalizeSymbol(row?.symbol);
        if (symbol !== ticker) continue;
        return row;
      }
    } catch (error) {
      if (String(error).includes("HTTP 404")) continue;
      console.log(`[market-fundamentals] ${ticker} tentativa falhou: ${String(error)}`);
    }
  }

  return null;
}

async function mapWithConcurrency(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current], current);
      await sleep(DELAY_MS);
    }
  }

  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => runner());
  await Promise.all(runners);
  return results;
}

async function main() {
  const token = process.env.BRAPI_TOKEN ?? "";
  if (!token) {
    console.log("[market-fundamentals] BRAPI_TOKEN ausente. Tentando sem token (ETFs podem falhar).");
  }

  console.log(
    `[market-fundamentals] Buscando fundamentos BRAPI para ${MARKET_UNIVERSE.length} ativos...`
  );

  const baseByKey = new Map(
    MARKET_UNIVERSE.map((item) => [`${item.assetClass}:${item.ticker.toUpperCase()}`, item])
  );

  const fetched = await mapWithConcurrency(MARKET_UNIVERSE, async (asset, index) => {
    const ticker = asset.ticker.toUpperCase();
    console.log(`[market-fundamentals] (${index + 1}/${MARKET_UNIVERSE.length}) ${ticker}...`);
    const row = await fetchFundamentalsForTicker(ticker, token);
    return { key: `${asset.assetClass}:${ticker}`, ticker, asset, row };
  });

  const items = [];

  for (const entry of fetched) {
    const seed = entry.asset;
    const row = entry.row;

    const pvp = normalizeRatio(row?.defaultKeyStatistics?.priceToBook ?? row?.priceToBook ?? seed.pvp);
    const pl = normalizeRatio(row?.priceEarnings ?? row?.defaultKeyStatistics?.forwardPE ?? seed.pl);

    const dyRaw =
      row?.defaultKeyStatistics?.dividendYield ??
      row?.defaultKeyStatistics?.yield ??
      seed.dividendYield12m;
    const dividendYield12m = normalizePercent(dyRaw, { maxPercent: 80, allowZero: true });

    const expenseRatio = extractExpenseRatioPercent(row) ?? seed.expenseRatio ?? null;
    const expectedAnnualReturn = toPositiveNumber(seed.expectedAnnualReturn) ?? null;

    const name =
      String(row?.shortName ?? row?.longName ?? seed.name ?? entry.ticker).trim() || entry.ticker;
    const category = String(seed.category ?? "").trim() || "Indefinido";

    items.push({
      ticker: entry.ticker,
      assetClass: seed.assetClass,
      name,
      category,
      pvp,
      pl,
      dividendYield12m,
      expenseRatio,
      expectedAnnualReturn,
    });
  }

  items.sort((a, b) => {
    if (a.assetClass === b.assetClass) return a.ticker.localeCompare(b.ticker);
    return a.assetClass.localeCompare(b.assetClass);
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    provider: "brapi (modules: defaultKeyStatistics, financialData) + curated seed",
    items,
  };

  const outPath = path.join(process.cwd(), "data", "market_fundamentals.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");

  const okPvp = items.filter((item) => typeof item.pvp === "number").length;
  const okPl = items.filter((item) => typeof item.pl === "number").length;
  const okDy = items.filter((item) => typeof item.dividendYield12m === "number").length;

  console.log(
    `[market-fundamentals] Gerado: ${items.length} itens. P/VP=${okPvp}, P/L=${okPl}, DY=${okDy}`
  );
}

main().catch((error) => {
  console.error("[market-fundamentals] Falhou:", error);
  process.exit(1);
});
