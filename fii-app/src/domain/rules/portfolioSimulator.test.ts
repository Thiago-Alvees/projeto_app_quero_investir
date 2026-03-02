import test from "node:test";
import assert from "node:assert/strict";

import { simulatePortfolio } from "./portfolioSimulator";

test("simulatePortfolio returns aggregated projection for selected assets", () => {
  const projection = simulatePortfolio({
    id: "p1",
    name: "Carteira teste",
    visibility: "PRIVADA",
    monthlyContribution: 1000,
    months: 12,
    reinvestDividends: true,
    assets: [
      { assetClass: "FII", ticker: "HGLG11" },
      { assetClass: "STOCK", ticker: "ITUB4" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  assert.ok(projection);
  assert.equal(projection.items.length, 2);
  assert.ok(projection.finalValue > projection.invested);
});

test("simulatePortfolio returns null when no assets are selected", () => {
  const projection = simulatePortfolio({
    id: "p2",
    name: "Vazia",
    visibility: "PRIVADA",
    monthlyContribution: 1000,
    months: 12,
    reinvestDividends: true,
    assets: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  assert.equal(projection, null);
});

