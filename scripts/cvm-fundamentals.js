const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const FII_APP_DIR = path.join(ROOT_DIR, "fii-app");
const OUT_PATH_DEFAULT = path.join(
  FII_APP_DIR,
  "src",
  "data",
  "static",
  "fiis_fundamentals_cvm.json"
);
const OVERRIDES_PATH = path.join(__dirname, "cvm-overrides.json");

const CVM_BASE_URL = "https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS";

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--out") {
      result.out = args[i + 1];
      i += 1;
    }
  }
  return result;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const handleError = (err) => {
      file.close(() => {
        fs.unlink(destPath, () => reject(err));
      });
    };

    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return handleError(new Error(`HTTP ${res.statusCode}`));
        }

        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", handleError);
  });
}

function extractZip(zipPath, destDir) {
  if (process.platform === "win32") {
    const command = `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`;
    execFileSync("powershell", ["-NoProfile", "-Command", command], {
      stdio: "inherit",
    });
    return;
  }

  execFileSync("unzip", ["-o", zipPath, "-d", destDir], { stdio: "inherit" });
}

function parseNumber(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(",", ".").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function sanitizeCnpj(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .trim();
}

function normalizeTicker(value) {
  return String(value ?? "")
    .toUpperCase()
    .trim();
}

function tickerFromIsin(value) {
  const isin = String(value ?? "")
    .toUpperCase()
    .trim();
  const match = isin.match(/^BR([A-Z0-9]{4})CTF\d{3}$/);
  if (!match) return null;
  return `${match[1]}11`;
}

function loadTickers() {
  const universePath = path.join(FII_APP_DIR, "src", "data", "static", "fiiUniverse.ts");
  const content = fs.readFileSync(universePath, "utf8");
  const matches = content.match(/"[A-Z0-9]{4,6}\d{2}"/g) || [];
  const unique = Array.from(new Set(matches.map((m) => m.replace(/"/g, ""))));
  return unique.sort();
}

function loadOverrides() {
  if (!fs.existsSync(OVERRIDES_PATH)) return { tickerToCnpj: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
    const tickerToCnpj =
      parsed && typeof parsed === "object" && parsed.tickerToCnpj
        ? parsed.tickerToCnpj
        : parsed;
    return { tickerToCnpj: tickerToCnpj ?? {} };
  } catch {
    return { tickerToCnpj: {} };
  }
}

function parseComplement(filePath, store) {
  const text = fs.readFileSync(filePath, "latin1");
  const lines = text.split(/\r?\n/);
  const header = lines.shift();
  if (!header) return;

  const cols = header.split(";");
  const idx = {
    cnpj: cols.indexOf("CNPJ_Fundo_Classe"),
    date: cols.indexOf("Data_Referencia"),
    pl: cols.indexOf("Patrimonio_Liquido"),
    vp: cols.indexOf("Valor_Patrimonial_Cotas"),
    dy: cols.indexOf("Percentual_Dividend_Yield_Mes"),
  };

  if (Object.values(idx).some((value) => value < 0)) {
    throw new Error("Required columns not found in complemento CSV.");
  }

  for (const line of lines) {
    if (!line.trim()) continue;
    const row = line.split(";");
    const cnpj = sanitizeCnpj(row[idx.cnpj]);
    const date = row[idx.date];
    if (!cnpj || !date) continue;

    const vp = parseNumber(row[idx.vp]);
    const pl = parseNumber(row[idx.pl]);
    const dy = parseNumber(row[idx.dy]);

    const latestAny = store.metricsAnyByCnpj.get(cnpj);
    if (!latestAny || date > latestAny.date) {
      store.metricsAnyByCnpj.set(cnpj, { date, vp, pl });
    }

    const hasPositiveMetric = (Number.isFinite(vp) && vp > 0) || (Number.isFinite(pl) && pl > 0);
    if (hasPositiveMetric) {
      const latestValid = store.metricsByCnpj.get(cnpj);
      if (!latestValid || date > latestValid.date) {
        store.metricsByCnpj.set(cnpj, { date, vp, pl });
      }
    }

    if (dy !== null) {
      const list = store.dySeriesByCnpj.get(cnpj) || [];
      list.push({ date, dy });
      store.dySeriesByCnpj.set(cnpj, list);
    }

    if (!store.globalLatestDate || date > store.globalLatestDate) {
      store.globalLatestDate = date;
    }
  }
}

function parseGeneral(filePath, store, tickerSet) {
  const text = fs.readFileSync(filePath, "latin1");
  const lines = text.split(/\r?\n/);
  const header = lines.shift();
  if (!header) return;

  const cols = header.split(";");
  const idx = {
    cnpj: cols.indexOf("CNPJ_Fundo_Classe"),
    date: cols.indexOf("Data_Referencia"),
    isin: cols.indexOf("Codigo_ISIN"),
  };

  if (Object.values(idx).some((value) => value < 0)) {
    throw new Error("Required columns not found in geral CSV.");
  }

  for (const line of lines) {
    if (!line.trim()) continue;
    const row = line.split(";");
    const cnpj = sanitizeCnpj(row[idx.cnpj]);
    const date = row[idx.date];
    const isin = row[idx.isin];
    const ticker = tickerFromIsin(isin);
    if (!ticker || !tickerSet.has(ticker) || !cnpj || !date) continue;

    const latest = store.tickerToCnpjRaw.get(ticker);
    if (!latest || date > latest.date) {
      store.tickerToCnpjRaw.set(ticker, { date, cnpj });
    }
  }
}

function computeDy12m(series) {
  if (!series || !series.length) {
    return { dy12m: null, dyStatus: "APURACAO" };
  }

  const ordered = [...series].sort((a, b) => (a.date < b.date ? 1 : -1));
  const last12 = ordered.slice(0, 12);
  if (last12.length < 12) {
    return { dy12m: null, dyStatus: "APURACAO" };
  }

  const sum = last12.reduce((acc, item) => acc + item.dy, 0);
  const dy12m = sum * 100;
  if (!Number.isFinite(dy12m) || dy12m < 0 || dy12m > 60) {
    return { dy12m: null, dyStatus: "APURACAO" };
  }

  return { dy12m, dyStatus: "OK" };
}

function normalizeItemNumbers(item) {
  const vp = Number.isFinite(item.vp) && item.vp > 0 ? item.vp : null;
  const pl = Number.isFinite(item.pl) && item.pl > 0 ? item.pl : null;
  const dy12m =
    Number.isFinite(item.dy12m) && item.dy12m >= 0 && item.dy12m <= 60 ? item.dy12m : null;
  const dyStatus = dy12m === null ? "APURACAO" : item.dyStatus ?? "OK";

  return { vp, pl, dy12m, dyStatus };
}

function applyOverrides(baseMap, tickers, overrides, warnings) {
  const map = new Map(baseMap);
  const tickerSet = new Set(tickers);

  for (const [rawTicker, rawCnpj] of Object.entries(overrides.tickerToCnpj || {})) {
    const ticker = normalizeTicker(rawTicker);
    const cnpj = sanitizeCnpj(rawCnpj);

    if (!tickerSet.has(ticker)) {
      warnings.push(`override ignored (unknown ticker): ${rawTicker}`);
      continue;
    }
    if (!cnpj) {
      warnings.push(`override ignored (invalid cnpj): ${rawTicker}`);
      continue;
    }

    map.set(ticker, cnpj);
  }

  return map;
}

function validateDuplicateCnpjs(tickerToCnpj) {
  const byCnpj = new Map();
  for (const [ticker, cnpj] of tickerToCnpj.entries()) {
    const list = byCnpj.get(cnpj) || [];
    list.push(ticker);
    byCnpj.set(cnpj, list);
  }

  return Array.from(byCnpj.entries())
    .filter(([, tickers]) => tickers.length > 1)
    .map(([cnpj, tickers]) => ({ cnpj, tickers: tickers.sort() }));
}

async function loadCvmData(tickers) {
  const tickerSet = new Set(tickers);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cvm-fii-"));
  const currentYear = new Date().getFullYear();
  let latestYear = null;

  for (const candidate of [currentYear, currentYear - 1, currentYear - 2]) {
    const url = `${CVM_BASE_URL}/inf_mensal_fii_${candidate}.zip`;
    const zipPath = path.join(tempDir, `inf_mensal_fii_${candidate}.zip`);
    try {
      await downloadFile(url, zipPath);
      latestYear = candidate;
      extractZip(zipPath, tempDir);
      break;
    } catch {
      // continue
    }
  }

  if (!latestYear) {
    throw new Error("Unable to download CVM file.");
  }

  const years = [latestYear, latestYear - 1];
  const store = {
    metricsByCnpj: new Map(),
    metricsAnyByCnpj: new Map(),
    dySeriesByCnpj: new Map(),
    tickerToCnpjRaw: new Map(),
    globalLatestDate: null,
  };

  for (const year of years) {
    const zipPath = path.join(tempDir, `inf_mensal_fii_${year}.zip`);
    if (!fs.existsSync(zipPath)) {
      const url = `${CVM_BASE_URL}/inf_mensal_fii_${year}.zip`;
      try {
        await downloadFile(url, zipPath);
        extractZip(zipPath, tempDir);
      } catch {
        continue;
      }
    }

    const complemento = path.join(tempDir, `inf_mensal_fii_complemento_${year}.csv`);
    const geral = path.join(tempDir, `inf_mensal_fii_geral_${year}.csv`);

    if (fs.existsSync(complemento)) parseComplement(complemento, store);
    if (fs.existsSync(geral)) parseGeneral(geral, store, tickerSet);
  }

  return store;
}

async function main() {
  const { out } = parseArgs();
  const outputPath = out ? path.resolve(out) : OUT_PATH_DEFAULT;

  const tickers = loadTickers();
  const overrides = loadOverrides();
  const cvmData = await loadCvmData(tickers);

  const warnings = [];
  const baseTickerToCnpj = new Map();
  for (const ticker of tickers) {
    const mapped = cvmData.tickerToCnpjRaw.get(ticker);
    if (mapped?.cnpj) {
      baseTickerToCnpj.set(ticker, mapped.cnpj);
    }
  }

  const tickerToCnpj = applyOverrides(baseTickerToCnpj, tickers, overrides, warnings);
  const duplicateCnpjs = validateDuplicateCnpjs(tickerToCnpj);

  const items = [];
  const missingTickerMap = [];
  const missingMetrics = [];

  for (const ticker of tickers) {
    const cnpj = tickerToCnpj.get(ticker);
    if (!cnpj) {
      missingTickerMap.push(ticker);
      continue;
    }

    const latest = cvmData.metricsByCnpj.get(cnpj) || cvmData.metricsAnyByCnpj.get(cnpj);
    if (!latest) {
      missingMetrics.push(ticker);
      continue;
    }

    const { dy12m, dyStatus } = computeDy12m(cvmData.dySeriesByCnpj.get(cnpj));
    const normalized = normalizeItemNumbers({
      vp: latest.vp,
      pl: latest.pl,
      dy12m,
      dyStatus,
    });

    if (normalized.vp === null && normalized.pl === null && normalized.dy12m === null) {
      missingMetrics.push(ticker);
      continue;
    }

    items.push({
      ticker,
      vp: normalized.vp,
      dy12m: normalized.dy12m,
      dyStatus: normalized.dyStatus,
      pl: normalized.pl,
    });
  }

  items.sort((a, b) => a.ticker.localeCompare(b.ticker));

  const output = {
    updatedAt: cvmData.globalLatestDate || new Date().toISOString().slice(0, 10),
    source: "CVM - INF_MENSAL FII (geral + complemento via ISIN)",
    audit: {
      mappingMethod: "ISIN->ticker + optional overrides",
      tickersRequested: tickers.length,
      tickersMapped: tickerToCnpj.size,
      itemsGenerated: items.length,
      duplicateCnpjs: duplicateCnpjs.length,
    },
    items,
  };

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  if (warnings.length) {
    console.log("[cvm] Warnings:");
    warnings.forEach((warning) => console.log(`- ${warning}`));
  }
  if (duplicateCnpjs.length) {
    console.log("[cvm] Duplicate ticker->CNPJ mapping detected:");
    duplicateCnpjs.forEach((item) =>
      console.log(`- CNPJ ${item.cnpj}: ${item.tickers.join(", ")}`)
    );
  }
  if (missingTickerMap.length) {
    console.log(`[cvm] Missing ticker->CNPJ mapping (${missingTickerMap.length}):`);
    console.log(`- ${missingTickerMap.join(", ")}`);
  }
  if (missingMetrics.length) {
    console.log(`[cvm] Missing fundamentals by CNPJ (${missingMetrics.length}):`);
    console.log(`- ${missingMetrics.join(", ")}`);
  }

  console.log(`[cvm] Fundamentos gerados: ${items.length}/${tickers.length}`);
  console.log(`[cvm] Arquivo salvo em: ${outputPath}`);
}

main().catch((err) => {
  console.error("[cvm] Failed to generate fundamentals:", err);
  process.exit(1);
});
