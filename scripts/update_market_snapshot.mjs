import fs from "fs/promises";
import path from "path";

import { MARKET_UNIVERSE } from "./market-universe.mjs";

const DELAY_MS = 450;
const MAX_ATTEMPTS = 4;
const CONCURRENCY = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSymbol(symbol) {
  return String(symbol ?? "").toUpperCase().replace(".SA", "").trim();
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

      if (response.status === 429) {
        const wait = 1200 * attempt;
        console.log(`[market-snapshot] HTTP 429. Retry ${attempt}/${maxAttempts} em ${wait}ms`);
        await sleep(wait);
        continue;
      }

      if (response.status >= 500 && response.status <= 599) {
        const wait = 800 * attempt;
        console.log(
          `[market-snapshot] HTTP ${response.status}. Retry ${attempt}/${maxAttempts} em ${wait}ms`
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
      if (String(error).includes("HTTP 404")) throw error;

      const wait = 800 * attempt;
      console.log(`[market-snapshot] Erro: ${String(error)}. Retry ${attempt}/${maxAttempts} em ${wait}ms`);
      await sleep(wait);
    }
  }

  throw lastError ?? new Error("Falha desconhecida ao buscar dados de mercado");
}

async function fetchQuoteForTicker(token, ticker) {
  const urls = [
    `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?range=1d&interval=1d&token=${encodeURIComponent(token)}`,
    `https://brapi.dev/api/quote/${encodeURIComponent(`${ticker}.SA`)}?range=1d&interval=1d&token=${encodeURIComponent(token)}`,
  ];

  for (const url of urls) {
    try {
      const json = await fetchJsonWithRetry(url);
      const results = Array.isArray(json?.results) ? json.results : [];

      for (const row of results) {
        const symbol = normalizeSymbol(row?.symbol);
        const price = Number(row?.regularMarketPrice ?? row?.price ?? row?.close);
        const marketTime = Number(row?.regularMarketTime);
        if (symbol !== ticker || !Number.isFinite(price) || price <= 0) continue;

        return {
          price,
          priceUpdatedAt:
            Number.isFinite(marketTime) && marketTime > 0
              ? new Date(marketTime > 1e12 ? marketTime : marketTime * 1000).toISOString()
              : null,
        };
      }
    } catch (error) {
      if (String(error).includes("HTTP 404")) {
        continue;
      }
      console.log(`[market-snapshot] ${ticker} tentativa falhou: ${String(error)}`);
    }
  }

  return { price: null, priceUpdatedAt: null };
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
  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    throw new Error("BRAPI_TOKEN nao encontrado no ambiente. Configure nos Secrets do GitHub.");
  }

  console.log(`[market-snapshot] Buscando cotacoes para ${MARKET_UNIVERSE.length} ativos...`);

  const items = await mapWithConcurrency(MARKET_UNIVERSE, async (asset, index) => {
    console.log(`[market-snapshot] (${index + 1}/${MARKET_UNIVERSE.length}) ${asset.ticker}...`);
    const quote = await fetchQuoteForTicker(token, asset.ticker);
    return {
      ticker: asset.ticker,
      assetClass: asset.assetClass,
      price: quote.price,
      priceUpdatedAt: quote.priceUpdatedAt,
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    provider: "brapi",
    items,
  };

  const outPath = path.join(process.cwd(), "data", "market_snapshot.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");

  const okCount = items.filter((item) => typeof item.price === "number").length;
  console.log(`[market-snapshot] Gerado: ${okCount}/${items.length} pre?os preenchidos.`);
}

main().catch((error) => {
  console.error("[market-snapshot] Falhou:", error);
  process.exit(1);
});
