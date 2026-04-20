import assert from "node:assert/strict";
import test from "node:test";

import { buildDividendCalendarEvents } from "./dividendCalendar";
import type { PortfolioAssetCatalogItem } from "../../data/mock/investmentCatalog";

const BASE_ITEMS: PortfolioAssetCatalogItem[] = [
  {
    ticker: "MXRF11",
    assetClass: "FII",
    name: "MXRF11 - Fundo Imobiliário",
    category: "Papel",
    price: 10,
    dividendYield12m: 12,
    expectedAnnualReturn: 12,
  },
  {
    ticker: "ITSA4",
    assetClass: "STOCK",
    name: "Itaúsa",
    category: "Financeiro",
    price: 10,
    dividendYield12m: 6,
    expectedAnnualReturn: 10,
  },
];

test("buildDividendCalendarEvents creates monthly events for FII", () => {
  const events = buildDividendCalendarEvents(BASE_ITEMS, {
    fromDate: new Date(Date.UTC(2026, 2, 1)),
    monthsAhead: 3,
  });

  const fiiEvents = events.filter((item) => item.ticker === "MXRF11");
  assert.equal(fiiEvents.length, 3);
  assert.equal(fiiEvents[0].paymentDateIso.slice(0, 10), "2026-03-15");
  assert.equal(fiiEvents[1].paymentDateIso.slice(0, 10), "2026-04-15");
  assert.equal(fiiEvents[2].paymentDateIso.slice(0, 10), "2026-05-15");
  assert.equal(fiiEvents[0].estimatedMonthly, 0.1);
  assert.equal(fiiEvents[0].estimatedPerEvent, 0.1);
});

test("buildDividendCalendarEvents creates quarterly events for stocks and ETFs", () => {
  const events = buildDividendCalendarEvents(BASE_ITEMS, {
    fromDate: new Date(Date.UTC(2026, 2, 20)),
    monthsAhead: 3,
  });

  const stockEvents = events.filter((item) => item.ticker === "ITSA4");
  assert.equal(stockEvents.length, 1);
  assert.equal(stockEvents[0].paymentDateIso.slice(0, 10), "2026-03-25");
  assert.equal(stockEvents[0].estimatedMonthly, 0.05);
  assert.equal(stockEvents[0].estimatedPerEvent, 0.15);
});
