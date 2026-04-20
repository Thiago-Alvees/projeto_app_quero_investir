import test from "node:test";
import assert from "node:assert/strict";

import { simulatePortfolio, simulatePortfolioTimeline } from "./portfolioSimulator";

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

test("simulatePortfolioTimeline returns monthly progression", () => {
  const timeline = simulatePortfolioTimeline({
    id: "p3",
    name: "Linha do tempo",
    visibility: "PRIVADA",
    monthlyContribution: 1000,
    months: 6,
    reinvestDividends: true,
    assets: [{ assetClass: "FII", ticker: "HGLG11" }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  assert.equal(timeline.length, 6);
  assert.equal(timeline[0].month, 1);
  assert.ok(timeline[5].invested >= 6000);
  assert.ok(timeline[5].estimatedValue >= timeline[5].invested);
});
