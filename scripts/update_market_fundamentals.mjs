import fs from "fs/promises";
import path from "path";

import { MARKET_UNIVERSE } from "./market-universe.mjs";

async function main() {
  const payload = {
    generatedAt: new Date().toISOString(),
    provider: "curated-seed",
    items: MARKET_UNIVERSE.map((item) => ({
      ticker: item.ticker,
      assetClass: item.assetClass,
      name: item.name,
      category: item.category,
      pvp: item.pvp ?? null,
      pl: item.pl ?? null,
      dividendYield12m: item.dividendYield12m ?? null,
      expenseRatio: item.expenseRatio ?? null,
      expectedAnnualReturn: item.expectedAnnualReturn ?? null,
    })),
  };

  const outPath = path.join(process.cwd(), "data", "market_fundamentals.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[market-fundamentals] Gerado: ${payload.items.length} itens.`);
}

main().catch((error) => {
  console.error("[market-fundamentals] Falhou:", error);
  process.exit(1);
});
