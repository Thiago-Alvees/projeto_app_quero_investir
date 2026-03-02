import test from "node:test";
import assert from "node:assert/strict";

import { analyzeMarketAsset } from "./marketValuation";

test("stock with low P/L and P/VP is classified as ATRATIVO", () => {
  const analysis = analyzeMarketAsset({
    ticker: "TEST3",
    assetClass: "STOCK",
    name: "Teste",
    category: "Financeiro",
    price: 10,
    pvp: 1.2,
    pl: 10,
    dividendYield12m: 5,
    expectedAnnualReturn: 12,
  });

  assert.equal(analysis.status, "ATRATIVO");
});

test("etf with high fee is classified as ESTICADO", () => {
  const analysis = analyzeMarketAsset({
    ticker: "ETF11",
    assetClass: "ETF",
    name: "ETF Teste",
    category: "Indice",
    price: 100,
    expenseRatio: 1.2,
    dividendYield12m: 0,
    expectedAnnualReturn: 7,
  });

  assert.equal(analysis.status, "ESTICADO");
});

