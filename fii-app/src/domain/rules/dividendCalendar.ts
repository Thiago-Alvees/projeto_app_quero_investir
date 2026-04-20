import type { PortfolioAssetCatalogItem } from "../../data/mock/investmentCatalog";

export type DividendCalendarEvent = {
  id: string;
  ticker: string;
  assetClass: "FII" | "STOCK" | "ETF";
  name: string;
  category: string;
  paymentDateIso: string;
  estimatedPerEvent: number;
  estimatedMonthly: number;
  dy12m: number;
};

type BuildDividendCalendarOptions = {
  monthsAhead?: number;
  fromDate?: Date;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function addUtcMonths(date: Date, months: number): Date {
  return toUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    date.getUTCDate()
  );
}

function getFirstPaymentDate(fromDate: Date, paymentDay: number): Date {
  const year = fromDate.getUTCFullYear();
  const month = fromDate.getUTCMonth();
  const day = fromDate.getUTCDate();

  if (day <= paymentDay) {
    return toUtcDate(year, month, paymentDay);
  }
  return toUtcDate(year, month + 1, paymentDay);
}

function monthlyDividendPerUnit(item: PortfolioAssetCatalogItem): number {
  if (!Number.isFinite(item.price) || item.price <= 0) return 0;
  if (!Number.isFinite(item.dividendYield12m) || item.dividendYield12m <= 0) return 0;
  return (item.price * item.dividendYield12m) / 100 / 12;
}

function frequencyByAssetClass(assetClass: "FII" | "STOCK" | "ETF"): 1 | 3 {
  return assetClass === "FII" ? 1 : 3;
}

function paymentDayByAssetClass(assetClass: "FII" | "STOCK" | "ETF"): number {
  return assetClass === "FII" ? 15 : 25;
}

export function buildDividendCalendarEvents(
  items: PortfolioAssetCatalogItem[],
  options?: BuildDividendCalendarOptions
): DividendCalendarEvent[] {
  const monthsAhead = Math.max(1, Math.floor(options?.monthsAhead ?? 3));
  const fromDate = options?.fromDate ?? new Date();
  const rangeStart = toUtcDate(
    fromDate.getUTCFullYear(),
    fromDate.getUTCMonth(),
    fromDate.getUTCDate()
  );
  const rangeEnd = addUtcMonths(rangeStart, monthsAhead);

  const events: DividendCalendarEvent[] = [];

  for (const item of items) {
    const monthly = monthlyDividendPerUnit(item);
    if (monthly <= 0) continue;

    const frequency = frequencyByAssetClass(item.assetClass);
    const paymentDay = paymentDayByAssetClass(item.assetClass);
    let cursor = getFirstPaymentDate(rangeStart, paymentDay);

    while (cursor <= rangeEnd) {
      const estimatedPerEvent = monthly * frequency;
      events.push({
        id: `${item.assetClass}:${item.ticker}:${cursor.toISOString().slice(0, 10)}`,
        ticker: item.ticker,
        assetClass: item.assetClass,
        name: item.name,
        category: item.category,
        paymentDateIso: cursor.toISOString(),
        estimatedPerEvent: round2(estimatedPerEvent),
        estimatedMonthly: round2(monthly),
        dy12m: round2(item.dividendYield12m),
      });

      cursor = addUtcMonths(cursor, frequency);
    }
  }

  return events.sort((a, b) => {
    const dateDiff =
      new Date(a.paymentDateIso).getTime() - new Date(b.paymentDateIso).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.dy12m - a.dy12m;
  });
}
