import type { Fii } from "../../../domain/models/fii";

export type DataSource = "SNAPSHOT" | "MOCK";

export type Result<T> =
  | {
      ok: true;
      data: T;
      source: DataSource;
      updatedAt?: string | null;
      fundamentalsUpdatedAt?: string | null;
    }
  | { ok: false; message: string };

export function isOk<T>(
  result: Result<T>
): result is {
  ok: true;
  data: T;
  source: DataSource;
  updatedAt?: string | null;
  fundamentalsUpdatedAt?: string | null;
} {
  return result.ok === true;
}

export type FiiSummary = {
  description?: string;
  sector?: string;
  industry?: string;
  website?: string;
  employees?: number;
};

export type FiiHistoryPoint = {
  date: number;
  close: number;
};

export type FiiDetail = {
  name?: string;
  summary?: FiiSummary;
  history: FiiHistoryPoint[];
};

export type Snapshot = {
  generatedAt: string | null;
  provider: string;
  items: Array<{ ticker: string; price: number | null }>;
};

export type FundamentalsItem = {
  ticker: string;
  vp?: number | null;
  dy12m?: number | null;
  dyStatus?: "OK" | "APURACAO";
  pl?: number | null;
};

export type Fundamentals = {
  updatedAt: string | null;
  source?: string;
  items: FundamentalsItem[];
};

export type BrapiQuoteItem = {
  shortName?: string;
  longName?: string;
  summaryProfile?: {
    longBusinessSummary?: string;
    description?: string;
    sector?: string;
    industry?: string;
    website?: string;
    fullTimeEmployees?: number;
  };
  historicalDataPrice?: Array<{
    date: number | string;
    close?: number;
  }>;
};

export type BrapiQuoteResponse = {
  results?: BrapiQuoteItem[];
  error?: string;
  message?: string;
};

export type FiiListCache = {
  data: Fii[];
  source: DataSource;
  updatedAt?: string | null;
  fundamentalsUpdatedAt?: string | null;
};
