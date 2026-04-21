import fs from "fs/promises";
import path from "path";

import { MARKET_UNIVERSE } from "./market-universe.mjs";

const DEFAULT_REMOTE_URL =
  "https://raw.githubusercontent.com/Thiago-Alvees/app_snapshot/main/data/market_snapshot.json";

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

async function fetchExistingSnapshot(remoteUrl) {
  try {
    const response = await fetch(remoteUrl, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) return null;

    const json = await response.json();
    if (!json || !Array.isArray(json.items)) return null;

    const byKey = new Map();
    for (const item of json.items) {
      const ticker = normalizeSymbol(item?.ticker);
      const assetClass = item?.assetClass;
      if (!ticker) continue;
      if (assetClass !== "STOCK" && assetClass !== "ETF") continue;

      byKey.set(`${assetClass}:${ticker}`, {
        ticker,
        assetClass,
        price: typeof item?.price === "number" ? item.price : null,
        priceUpdatedAt: item?.priceUpdatedAt ? String(item.priceUpdatedAt) : null,
      });
    }

    return { byKey };
  } catch (error) {
    console.log(`[market-snapshot] Snapshot remoto indisponivel para merge: ${String(error)}`);
    return null;
  }
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

function parseIntFromEnv(name) {
  const raw = process.env[name];
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveShardIndex(shards) {
  const explicit = parseIntFromEnv("MARKET_SNAPSHOT_SHARD_INDEX");
  if (explicit !== null && explicit >= 0) return explicit % shards;

  // O workflow roda a cada 3h, entao usamos a janela de 3h UTC como rotacao padrao.
  const utcHour = new Date().getUTCHours();
  const slot = Math.floor(utcHour / 3);
  return slot % shards;
}

async function main() {
  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    throw new Error("BRAPI_TOKEN nao encontrado no ambiente. Configure nos Secrets do GitHub.");
  }

  const shards = parseIntFromEnv("MARKET_SNAPSHOT_SHARDS") ?? 1;
  const remoteUrl = process.env.MARKET_SNAPSHOT_REMOTE_URL ?? DEFAULT_REMOTE_URL;

  const existing =
    Number.isFinite(shards) && shards > 1 ? await fetchExistingSnapshot(remoteUrl) : null;

  // Se o snapshot remoto ainda nao cobre a maioria do universo atual, faz refresh completo
  // para evitar que o app fique horas com ativos sem cotacao.
  let shouldFullRefresh = !existing;
  if (existing?.byKey) {
    const keys = new Set(MARKET_UNIVERSE.map((asset) => `${asset.assetClass}:${asset.ticker}`));
    let covered = 0;
    for (const key of existing.byKey.keys()) {
      if (keys.has(key)) covered += 1;
    }

    const coverage = keys.size > 0 ? covered / keys.size : 0;
    shouldFullRefresh = coverage < 0.7;
    if (shouldFullRefresh) {
      console.log(
        `[market-snapshot] Snapshot remoto cobre apenas ${(coverage * 100).toFixed(
          0
        )}%. Fazendo refresh completo.`
      );
    }
  }

  const shardIndex =
    !shouldFullRefresh && Number.isFinite(shards) && shards > 1 ? resolveShardIndex(shards) : 0;

  const universeToUpdate =
    !shouldFullRefresh && Number.isFinite(shards) && shards > 1
      ? MARKET_UNIVERSE.filter((_, index) => index % shards === shardIndex)
      : MARKET_UNIVERSE;

  if (!shouldFullRefresh && Number.isFinite(shards) && shards > 1) {
    console.log(
      `[market-snapshot] Sharding ativo: shard ${shardIndex + 1}/${shards} (${universeToUpdate.length}/${
        MARKET_UNIVERSE.length
      })`
    );
  }

  console.log(`[market-snapshot] Buscando cotacoes para ${universeToUpdate.length} ativos...`);

  const fetched = await mapWithConcurrency(universeToUpdate, async (asset, index) => {
    console.log(`[market-snapshot] (${index + 1}/${universeToUpdate.length}) ${asset.ticker}...`);
    const quote = await fetchQuoteForTicker(token, asset.ticker);
    return {
      key: `${asset.assetClass}:${asset.ticker}`,
      quote,
    };
  });

  const fetchedByKey = new Map();
  for (const entry of fetched) {
    fetchedByKey.set(entry.key, entry.quote);
  }

  const items = MARKET_UNIVERSE.map((asset) => {
    const key = `${asset.assetClass}:${asset.ticker}`;
    const quote = fetchedByKey.get(key);
    if (quote) {
      return {
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        price: quote.price,
        priceUpdatedAt: quote.priceUpdatedAt,
      };
    }

    const previous = existing?.byKey?.get(key);
    return {
      ticker: asset.ticker,
      assetClass: asset.assetClass,
      price: previous?.price ?? null,
      priceUpdatedAt: previous?.priceUpdatedAt ?? null,
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
  console.log(`[market-snapshot] Gerado: ${okCount}/${items.length} precos preenchidos.`);
}

main().catch((error) => {
  console.error("[market-snapshot] Falhou:", error);
  process.exit(1);
});
