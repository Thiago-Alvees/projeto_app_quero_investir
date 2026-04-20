import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Fii } from "../../domain/models/fii";

const ALERT_RULES_KEY = "alerts:fii:r1";

export type FiiAlertRule = {
  ticker: string;
  maxPrice?: number | null;
  minDy?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type FiiAlertHit = {
  ticker: string;
  reason: string;
  createdAt: string;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sanitizeRule(input: Omit<FiiAlertRule, "createdAt" | "updatedAt">): Omit<FiiAlertRule, "createdAt" | "updatedAt"> {
  const maxPrice =
    typeof input.maxPrice === "number" && Number.isFinite(input.maxPrice) && input.maxPrice > 0
      ? round2(input.maxPrice)
      : null;

  const minDy =
    typeof input.minDy === "number" && Number.isFinite(input.minDy) && input.minDy > 0
      ? round2(input.minDy)
      : null;

  return {
    ticker: input.ticker.toUpperCase().trim(),
    maxPrice,
    minDy,
  };
}

export async function listFiiAlertRules(): Promise<FiiAlertRule[]> {
  try {
    const raw = await AsyncStorage.getItem(ALERT_RULES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FiiAlertRule[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item?.ticker === "string");
  } catch {
    return [];
  }
}

async function saveRules(rules: FiiAlertRule[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ALERT_RULES_KEY, JSON.stringify(rules));
  } catch {
    // ignore persistence errors
  }
}

export async function upsertFiiAlertRule(input: {
  ticker: string;
  maxPrice?: number | null;
  minDy?: number | null;
}): Promise<FiiAlertRule | null> {
  const normalized = sanitizeRule(input);
  if (!normalized.ticker) return null;
  if (!normalized.maxPrice && !normalized.minDy) return null;

  const now = new Date().toISOString();
  const rules = await listFiiAlertRules();
  const index = rules.findIndex((rule) => rule.ticker === normalized.ticker);

  const nextRule: FiiAlertRule = {
    ticker: normalized.ticker,
    maxPrice: normalized.maxPrice,
    minDy: normalized.minDy,
    createdAt: index >= 0 ? rules[index].createdAt : now,
    updatedAt: now,
  };

  const next = [...rules];
  if (index >= 0) {
    next[index] = nextRule;
  } else {
    next.unshift(nextRule);
  }

  await saveRules(next);
  return nextRule;
}

export async function removeFiiAlertRule(ticker: string): Promise<void> {
  const target = ticker.toUpperCase().trim();
  const rules = await listFiiAlertRules();
  const next = rules.filter((rule) => rule.ticker !== target);
  await saveRules(next);
}

export async function getFiiAlertRule(ticker: string): Promise<FiiAlertRule | null> {
  const target = ticker.toUpperCase().trim();
  const rules = await listFiiAlertRules();
  return rules.find((item) => item.ticker === target) ?? null;
}

export function evaluateFiiAlertHits(fiis: Fii[], rules: FiiAlertRule[]): FiiAlertHit[] {
  const byTicker = new Map(fiis.map((fii) => [fii.ticker.toUpperCase(), fii]));
  const hits: FiiAlertHit[] = [];

  for (const rule of rules) {
    const fii = byTicker.get(rule.ticker.toUpperCase());
    if (!fii) continue;

    const reasons: string[] = [];
    const priceValid = Number.isFinite(fii.price) && fii.price > 0;
    const dyValid = Number.isFinite(fii.dividendYield12m) && fii.dividendYield12m > 0;

    if (rule.maxPrice && priceValid && fii.price <= rule.maxPrice) {
      reasons.push(`Preço em ${fii.price.toFixed(2)} abaixo de ${rule.maxPrice.toFixed(2)}`);
    }
    if (rule.minDy && dyValid && fii.dividendYield12m >= rule.minDy) {
      reasons.push(`DY em ${fii.dividendYield12m.toFixed(2)}% acima de ${rule.minDy.toFixed(2)}%`);
    }

    if (reasons.length) {
      hits.push({
        ticker: rule.ticker,
        reason: reasons.join(" | "),
        createdAt: new Date().toISOString(),
      });
    }
  }

  return hits;
}
