import test from "node:test";
import assert from "node:assert/strict";

import { computePvp } from "./pvp";

test("computePvp uses price/vp when both are valid", () => {
  const result = computePvp({
    ticker: "TEST11",
    type: "Logistica",
    price: 99,
    vp: 90,
    dividendYield12m: 8,
  });

  assert.equal(result, 1.1);
});

test("computePvp returns fallback pvp when vp is missing", () => {
  const result = computePvp({
    ticker: "TEST11",
    type: "Logistica",
    price: 99,
    pvp: 0.97,
    dividendYield12m: 8,
  });

  assert.equal(result, 0.97);
});

test("computePvp returns NaN when price is invalid", () => {
  const result = computePvp({
    ticker: "TEST11",
    type: "Logistica",
    price: 0,
    vp: 100,
    dividendYield12m: 8,
  });

  assert.equal(Number.isNaN(result), true);
});

test("computePvp returns NaN when no valid vp or fallback exists", () => {
  const result = computePvp({
    ticker: "TEST11",
    type: "Logistica",
    price: 100,
    vp: 0,
    dividendYield12m: 8,
  });

  assert.equal(Number.isNaN(result), true);
});
