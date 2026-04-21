import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

import { MARKET_UNIVERSE } from "./market-universe.mjs";

const CVM_IPE_BASE_URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS";

const IMPORTANT_CATEGORIES = new Set([
  "Fato Relevante",
  "Comunicado ao Mercado",
  "Aviso aos Acionistas",
  "Aviso ao Mercado",
]);

const LOOKBACK_DAYS = 120;
const MAX_ITEMS_PER_TICKER = 80;

function parseArgs() {
  const args = process.argv.slice(2);
  const output = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--out") {
      output.out = args[i + 1];
      i += 1;
    }
  }
  return output;
}

function ensureDir(dirPath) {
  return fs.mkdir(dirPath, { recursive: true });
}

async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destPath, buffer);
}

function extractZip(zipPath, destDir) {
  if (process.platform === "win32") {
    const command = `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`;
    execFileSync("powershell", ["-NoProfile", "-Command", command], { stdio: "inherit" });
    return;
  }

  execFileSync("unzip", ["-o", zipPath, "-d", destDir], { stdio: "inherit" });
}

function parseCsvLine(line, delimiter = ";") {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      values.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  values.push(current);
  return values;
}

function toTrimmedString(value) {
  return String(value ?? "").trim();
}

function toUpper(value) {
  return toTrimmedString(value).toUpperCase();
}

function parseDateTimeToIso(value) {
  const raw = toTrimmedString(value);
  if (!raw) return null;

  // CVM typically uses YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isoDateToMs(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function buildTickerIndex() {
  const map = new Map();

  for (const item of MARKET_UNIVERSE) {
    if (item.assetClass !== "STOCK") continue;
    const cvmCode = Number(item.cvmCode);
    if (!Number.isFinite(cvmCode) || cvmCode <= 0) continue;
    const key = String(Math.trunc(cvmCode));
    const list = map.get(key) ?? [];
    list.push({
      ticker: toUpper(item.ticker),
      assetClass: item.assetClass,
      name: item.name,
    });
    map.set(key, list);
  }

  return map;
}

async function loadIpeCsvForYear(year, tempDir) {
  const zipUrl = `${CVM_IPE_BASE_URL}/ipe_cia_aberta_${year}.zip`;
  const zipPath = path.join(tempDir, `ipe_cia_aberta_${year}.zip`);
  const csvPath = path.join(tempDir, `ipe_cia_aberta_${year}.csv`);

  await downloadFile(zipUrl, zipPath);
  extractZip(zipPath, tempDir);

  const buffer = await fs.readFile(csvPath);

  // CVM datasets may change encodings across years. Prefer UTF-8, fallback to latin1 when the file
  // contains invalid UTF-8 sequences (rendered as the replacement char).
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) return utf8;
  return buffer.toString("latin1");
}

function buildEventsFromCsv(csvText, tickerIndex, cutoffMs) {
  const lines = csvText.split(/\r?\n/);
  const header = lines.shift();
  if (!header) return [];

  const columns = parseCsvLine(header);
  const idx = {
    companyName: columns.indexOf("Nome_Companhia"),
    cvmCode: columns.indexOf("Codigo_CVM"),
    referenceDate: columns.indexOf("Data_Referencia"),
    category: columns.indexOf("Categoria"),
    type: columns.indexOf("Tipo"),
    subject: columns.indexOf("Assunto"),
    species: columns.indexOf("Especie"),
    deliveredAt: columns.indexOf("Data_Entrega"),
    protocol: columns.indexOf("Protocolo_Entrega"),
    version: columns.indexOf("Versao"),
    url: columns.indexOf("Link_Download"),
  };

  if (Object.values(idx).some((value) => value < 0)) {
    throw new Error("CSV IPE: colunas esperadas nao encontradas.");
  }

  const seen = new Set();
  const output = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const row = parseCsvLine(line);
    const cvmCodeRaw = toTrimmedString(row[idx.cvmCode]);
    if (!cvmCodeRaw) continue;
    if (!tickerIndex.has(cvmCodeRaw)) continue;

    const category = toTrimmedString(row[idx.category]);
    if (!IMPORTANT_CATEGORIES.has(category)) continue;

    const deliveredAtIso = parseDateTimeToIso(row[idx.deliveredAt]);
    const referenceIso = parseDateTimeToIso(row[idx.referenceDate]);
    const sortMs = isoDateToMs(deliveredAtIso) || isoDateToMs(referenceIso);
    if (sortMs && sortMs < cutoffMs) continue;

    const companyName = toTrimmedString(row[idx.companyName]);
    const type = toTrimmedString(row[idx.type]);
    const subject = toTrimmedString(row[idx.subject]) || toTrimmedString(row[idx.species]);
    const protocol = toTrimmedString(row[idx.protocol]);
    const version = toTrimmedString(row[idx.version]);
    const url = toTrimmedString(row[idx.url]);

    for (const asset of tickerIndex.get(cvmCodeRaw) ?? []) {
      const idBase = protocol ? protocol : `${cvmCodeRaw}:${referenceIso ?? ""}:${subject}`;
      const id = `${idBase}:${asset.ticker}`;
      if (seen.has(id)) continue;
      seen.add(id);

      output.push({
        id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        cvmCode: Number(cvmCodeRaw),
        companyName: companyName || asset.name,
        category,
        type,
        subject,
        referenceDate: referenceIso,
        deliveredAt: deliveredAtIso,
        url,
        version: version || null,
        protocol: protocol || null,
      });
    }
  }

  output.sort((a, b) => {
    const aMs = isoDateToMs(a.deliveredAt) || isoDateToMs(a.referenceDate);
    const bMs = isoDateToMs(b.deliveredAt) || isoDateToMs(b.referenceDate);
    return bMs - aMs;
  });

  const counts = new Map();
  const limited = [];
  for (const item of output) {
    const current = counts.get(item.ticker) ?? 0;
    if (current >= MAX_ITEMS_PER_TICKER) continue;
    counts.set(item.ticker, current + 1);
    limited.push(item);
  }

  return limited;
}

async function main() {
  const { out } = parseArgs();
  const outputPath = out ? path.resolve(out) : path.join(process.cwd(), "data", "events_feed.json");

  const tickerIndex = buildTickerIndex();
  const years = [new Date().getFullYear(), new Date().getFullYear() - 1];
  const cutoffMs = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cvm-ipe-"));

  const items = [];
  const audit = {
    source: "CVM - CIA_ABERTA DOC IPE",
    yearsAttempted: years,
    yearsLoaded: [],
    tickersCovered: Array.from(new Set([].concat(...Array.from(tickerIndex.values()).map((l) => l.map((x) => x.ticker))))).length,
    itemsGenerated: 0,
  };

  for (const year of years) {
    try {
      const csvText = await loadIpeCsvForYear(year, tempDir);
      const parsed = buildEventsFromCsv(csvText, tickerIndex, cutoffMs);
      items.push(...parsed);
      audit.yearsLoaded.push(year);
    } catch (error) {
      console.log(`[events] ${year} indisponivel: ${String(error)}`);
    }
  }

  const dedup = new Map();
  for (const item of items) {
    dedup.set(item.id, item);
  }

  const dedupedItems = Array.from(dedup.values()).sort((a, b) => {
    const aMs = isoDateToMs(a.deliveredAt) || isoDateToMs(a.referenceDate);
    const bMs = isoDateToMs(b.deliveredAt) || isoDateToMs(b.referenceDate);
    return bMs - aMs;
  });

  audit.itemsGenerated = dedupedItems.length;

  const payload = {
    generatedAt: new Date().toISOString(),
    provider: "CVM IPE",
    items: dedupedItems,
    audit,
  };

  await ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[events] Gerado: ${dedupedItems.length} itens -> ${outputPath}`);
}

main().catch((error) => {
  console.error("[events] Falhou:", error);
  process.exit(1);
});
