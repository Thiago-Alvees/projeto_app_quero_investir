// scripts/update_snapshot.mjs
// Gera data/fiis_snapshot.json com preços.
// Compatível com plano gratuito da brapi: 1 ticker por requisição. :contentReference[oaicite:3]{index=3}

import fs from "fs/promises";
import path from "path";

const TICKERS = [
  // Logística (12)
  "HGLG11","XPLG11","VILG11","BTLG11","GGRC11","LOGG11","LVBI11","HSLG11","SARE11","BRCO11","PLOG11","RBRL11",
  // Shoppings (8)
  "VISC11","XPML11","HSML11","MALL11","FLRP11","HGBS11","TORD11","ABCP11",
  // Lajes (8)
  "KNRI11","HGRE11","RCRB11","VINO11","BRCR11","PVBI11","JSRE11","AIEC11",
  // Papel / CRI (12)
  "MXRF11","CPTS11","KNCR11","KNSC11","RECR11","VGIR11","RBRR11","IRDM11","HCTR11","DEVA11","URPR11","VGHF11",
  // Híbridos / Outros (10)
  "BCFF11","RBRF11","HGRU11","RBVA11","RECT11","ALZR11","RBED11","FIIB11","RZTR11","MORE11"
];

const DELAY_MS = 450; // intervalo entre tickers (ajuste se precisar)
const MAX_ATTEMPTS = 4;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJsonWithRetry(url, maxAttempts = MAX_ATTEMPTS) {
  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url);

      if (res.status === 429) {
        const wait = 1200 * attempt; // backoff
        console.log(`[snapshot] HTTP 429. Retry ${attempt}/${maxAttempts} em ${wait}ms`);
        await sleep(wait);
        continue;
      }

      if (res.status >= 500 && res.status <= 599) {
        const wait = 800 * attempt;
        console.log(`[snapshot] HTTP ${res.status}. Retry ${attempt}/${maxAttempts} em ${wait}ms`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} - ${text.slice(0, 200)}`);
      }

      return await res.json();
    } catch (e) {
      lastErr = e;
      const wait = 800 * attempt;
      console.log(`[snapshot] Erro: ${String(e)}. Retry ${attempt}/${maxAttempts} em ${wait}ms`);
      await sleep(wait);
    }
  }

  throw lastErr ?? new Error("Falha desconhecida ao buscar dados");
}

function normalizeSymbol(symbol) {
  return String(symbol ?? "").toUpperCase().replace(".SA", "").trim();
}

async function fetchPriceForTicker(token, ticker) {
  // Tentativa 1: sem .SA
  const url1 =
    `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}` +
    `?range=1d&interval=1d&token=${encodeURIComponent(token)}`;

  // Tentativa 2: com .SA
  const url2 =
    `https://brapi.dev/api/quote/${encodeURIComponent(`${ticker}.SA`)}` +
    `?range=1d&interval=1d&token=${encodeURIComponent(token)}`;

  const tryOne = async (url) => {
    const json = await fetchJsonWithRetry(url);
    const results = Array.isArray(json?.results) ? json.results : [];
    for (const r of results) {
      const sym = normalizeSymbol(r?.symbol);
      const price = Number(r?.regularMarketPrice);
      if (sym === ticker && Number.isFinite(price)) return price;
    }
    return null;
  };

  try {
    const p1 = await tryOne(url1);
    if (typeof p1 === "number") return p1;
  } catch (e) {
    // segue para .SA
    console.log(`[snapshot] ${ticker} tentativa sem .SA falhou: ${String(e)}`);
  }

  try {
    const p2 = await tryOne(url2);
    if (typeof p2 === "number") return p2;
  } catch (e) {
    console.log(`[snapshot] ${ticker} tentativa com .SA falhou: ${String(e)}`);
  }

  return null;
}

async function main() {
  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    throw new Error("BRAPI_TOKEN não encontrado no ambiente. Configure nos Secrets do GitHub.");
  }

  console.log("[snapshot] Buscando cotações (1 ticker por requisição)...");
  const items = [];

  for (let i = 0; i < TICKERS.length; i++) {
    const ticker = TICKERS[i];
    console.log(`[snapshot] (${i + 1}/${TICKERS.length}) ${ticker}...`);

    const price = await fetchPriceForTicker(token, ticker);
    items.push({ ticker, price });

    await sleep(DELAY_MS);
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    provider: "brapi",
    items
  };

  const outPath = path.join(process.cwd(), "data", "fiis_snapshot.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(snapshot, null, 2), "utf8");

  const okCount = items.filter((x) => typeof x.price === "number").length;
  console.log(`[snapshot] Gerado: ${okCount}/${items.length} preços preenchidos.`);
}

main().catch((e) => {
  console.error("[snapshot] Falhou:", e);
  process.exit(1);
});
