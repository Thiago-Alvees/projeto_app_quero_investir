import { INVESTMENT_CATALOG_BY_KEY } from "../../data/mock/investmentCatalog";
import type { PortfolioAssetCatalogItem } from "../../data/mock/investmentCatalog";
import type {
  InvestmentPortfolio,
  PortfolioProjection,
  PortfolioProjectionItem,
} from "../models/portfolio";
import {
  simulateFiiRecurringContribution,
  simulateRecurringContribution,
} from "./simulator";

function toAssetKey(assetClass: string, ticker: string): string {
  return `${assetClass}:${ticker}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function simulateItem(
  ticker: string,
  assetClass: "FII" | "STOCK" | "ETF",
  monthlyContribution: number,
  months: number,
  reinvestDividends: boolean,
  catalogByKey: Map<string, PortfolioAssetCatalogItem>
): PortfolioProjectionItem | null {
  const catalogItem = catalogByKey.get(toAssetKey(assetClass, ticker));
  if (!catalogItem) return null;

  const invested = monthlyContribution * months;
  const dy = Number.isFinite(catalogItem.dividendYield12m) ? catalogItem.dividendYield12m : 0;

  if (
    assetClass === "FII" &&
    Number.isFinite(catalogItem.price) &&
    catalogItem.price > 0 &&
    dy > 0
  ) {
    const fiiProjection = simulateFiiRecurringContribution({
      monthlyContribution,
      months,
      price: catalogItem.price,
      dyAnnual: dy,
      reinvestDividends,
    });

    if (!fiiProjection) return null;

    return {
      ticker,
      assetClass,
      monthlyContribution,
      invested: round2(invested),
      finalValue: round2(fiiProjection.finalValue),
      gain: round2(fiiProjection.totalGain),
      monthlyIncomeAtEnd: round2(fiiProjection.monthlyIncome),
    };
  }

  const genericProjection = simulateRecurringContribution({
    monthlyContribution,
    months,
    annualRate: catalogItem.expectedAnnualReturn,
  });
  if (!genericProjection) return null;

  const monthlyIncomeAtEnd = genericProjection.finalValue * (dy / 100 / 12);

  return {
    ticker,
    assetClass,
    monthlyContribution,
    invested: round2(invested),
    finalValue: round2(genericProjection.finalValue),
    gain: round2(genericProjection.totalGain),
    monthlyIncomeAtEnd: round2(monthlyIncomeAtEnd),
  };
}

export function simulatePortfolio(
  portfolio: InvestmentPortfolio,
  catalogByKey: Map<string, PortfolioAssetCatalogItem> = INVESTMENT_CATALOG_BY_KEY
): PortfolioProjection | null {
  if (!portfolio.assets.length) return null;
  if (!Number.isFinite(portfolio.monthlyContribution) || portfolio.monthlyContribution <= 0) {
    return null;
  }
  if (!Number.isFinite(portfolio.months) || portfolio.months <= 0) return null;

  const months = Math.max(1, Math.floor(portfolio.months));
  const perAssetContribution = portfolio.monthlyContribution / portfolio.assets.length;
  const items: PortfolioProjectionItem[] = [];

  for (const asset of portfolio.assets) {
    const item = simulateItem(
      asset.ticker,
      asset.assetClass,
      perAssetContribution,
      months,
      portfolio.reinvestDividends,
      catalogByKey
    );
    if (item) items.push(item);
  }

  if (!items.length) return null;

  const invested = items.reduce((acc, item) => acc + item.invested, 0);
  const finalValue = items.reduce((acc, item) => acc + item.finalValue, 0);
  const gain = finalValue - invested;
  const monthlyIncomeAtEnd = items.reduce((acc, item) => acc + item.monthlyIncomeAtEnd, 0);

  return {
    invested: round2(invested),
    finalValue: round2(finalValue),
    gain: round2(gain),
    monthlyIncomeAtEnd: round2(monthlyIncomeAtEnd),
    items,
  };
}
