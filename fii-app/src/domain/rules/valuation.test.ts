import test from "node:test";
import assert from "node:assert/strict";

import {
  PVP_ATTRACTIVE_MAX,
  PVP_FAIR_MAX,
  getValuationBreakdown,
  getValuationStatus,
} from "./valuation";

test("getValuationStatus follows the expected threshold rule", () => {
  assert.equal(getValuationStatus(0.94), "ATRATIVO");
  assert.equal(getValuationStatus(PVP_ATTRACTIVE_MAX), "JUSTO");
  assert.equal(getValuationStatus(1), "JUSTO");
  assert.equal(getValuationStatus(PVP_FAIR_MAX), "JUSTO");
  assert.equal(getValuationStatus(1.11), "ESTICADO");
});

test("getValuationStatus returns INDEFINIDO for invalid numbers", () => {
  assert.equal(getValuationStatus(Number.NaN), "INDEFINIDO");
  assert.equal(getValuationStatus(0), "INDEFINIDO");
  assert.equal(getValuationStatus(-1), "INDEFINIDO");
});

test("getValuationBreakdown explains range and distance to fair reference", () => {
  const breakdown = getValuationBreakdown(0.9);
  assert.ok(breakdown);
  assert.equal(breakdown.status, "ATRATIVO");
  assert.equal(breakdown.rangeLabel, `P/VP < ${PVP_ATTRACTIVE_MAX.toFixed(2)}`);
  assert.equal(breakdown.direction, "ABAIXO");
  assert.ok(Math.abs(breakdown.distanceToReference - 0.1) < 1e-9);
});

test("getValuationBreakdown returns null for invalid pvp", () => {
  assert.equal(getValuationBreakdown(0), null);
});
