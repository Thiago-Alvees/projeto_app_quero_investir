// scripts/update_snapshot.mjs
// Gera data/fiis_snapshot.json com preços (1 request).
// Requer env: BRAPI_TOKEN

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, options, maxAttempts = 3) {
  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);

      // 429 / 5xx: retry
      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        const wait = 1000 * attempt;
        console.log(`[snapshot] HTTP ${res.status}. Retry ${attempt}/${maxAttempts} em ${wait}ms`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} - ${text.slice(0, 200)}`);
      }

      return res;
    } catch (e) {
      lastErr = e;
      const wait = 1000 * attempt;
      console.log(`[snapshot] Erro: ${String(e)}. Retry ${attempt}/${maxAttempts} em ${wait}ms`);
      await sleep(wait);
    }
  }

  throw lastErr ?? new Error("Falha desconhecida ao buscar dados");
}

function normalizeSymbol(symbol) {
  return String(symbol ?? "").toUpperCase().replace(".SA", "").trim();
}

async function main() {
  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    throw new Error("BRAPI_TOKEN não encontrado no ambiente. Configure nos Secrets do GitHub.");
  }

  const symbols = TICKERS.join(",");
  const url =
    `https://brapi.dev/api/quote/${encodeURIComponent(symbols)}` +
    `?range=1d&interval=1d&token=${encodeURIComponent(token)}`;

  console.log("[snapshot] Buscando cotações...");
  const res = await fetchWithRetry(url, { method: "GET" }, 3);
  const json = await res.json();

  const results = Array.isArray(json?.results) ? json.results : [];
  const priceMap = new Map();

  for (const r of results) {
    const sym = normalizeSymbol(r?.symbol);
    const price = Number(r?.regularMarketPrice);
    if (sym && Number.isFinite(price)) priceMap.set(sym, price);
  }

  // Monta items na ordem do universo
  const items = TICKERS.map((t) => ({
    ticker: t,
    price: priceMap.get(t) ?? null
  }));

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
