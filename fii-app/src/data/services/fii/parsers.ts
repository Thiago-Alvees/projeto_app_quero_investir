import type {
  BrapiQuoteResponse,
  FiiDetail,
  FiiHistoryPoint,
  FiiSummary,
} from "./types";

export function normalizeBrapiDate(value: number | string): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  return null;
}

export function parseBrapiDetail(response: BrapiQuoteResponse): FiiDetail | null {
  const item = response?.results?.[0];
  if (!item) return null;

  const profile = item.summaryProfile;
  const summary: FiiSummary | undefined = profile
    ? {
        description: profile.longBusinessSummary ?? profile.description,
        sector: profile.sector,
        industry: profile.industry,
        website: profile.website,
        employees: profile.fullTimeEmployees,
      }
    : undefined;

  const history: FiiHistoryPoint[] = Array.isArray(item.historicalDataPrice)
    ? item.historicalDataPrice
        .map((row) => {
          const close = Number(row.close);
          const date = normalizeBrapiDate(row.date);
          if (!Number.isFinite(close) || date === null) return null;
          return { date, close };
        })
        .filter((row): row is FiiHistoryPoint => row !== null)
        .sort((a, b) => b.date - a.date)
    : [];

  return {
    name: item.longName ?? item.shortName,
    summary,
    history,
  };
}
