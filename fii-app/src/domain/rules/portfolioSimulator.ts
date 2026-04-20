import { INVESTMENT_CATALOG_BY_KEY } from "../../data/mock/investmentCatalog";
import type { PortfolioAssetCatalogItem } from "../../data/mock/investmentCatalog";
import type {
  InvestmentPortfolio,
  PortfolioProjection,
  PortfolioProjectionItem,
  PortfolioTimelinePoint,
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

function toMonthlyRate(annualRate: number): number {
  if (!Number.isFinite(annualRate) || annualRate <= -100) return 0;
  return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
}

function toMonthlyDy(dyAnnual: number): number {
  if (!Number.isFinite(dyAnnual) || dyAnnual <= 0) return 0;
  return dyAnnual / 100 / 12;
}

export function simulatePortfolioTimeline(
  portfolio: InvestmentPortfolio,
  catalogByKey: Map<string, PortfolioAssetCatalogItem> = INVESTMENT_CATALOG_BY_KEY
): PortfolioTimelinePoint[] {
  if (!portfolio.assets.length) return [];
  if (!Number.isFinite(portfolio.monthlyContribution) || portfolio.monthlyContribution <= 0) {
    return [];
  }
  if (!Number.isFinite(portfolio.months) || portfolio.months <= 0) return [];

  const months = Math.max(1, Math.floor(portfolio.months));
  const perAssetContribution = portfolio.monthlyContribution / portfolio.assets.length;

  const assetStates = portfolio.assets
    .map((asset) => {
      const catalogItem = catalogByKey.get(toAssetKey(asset.assetClass, asset.ticker));
      if (!catalogItem) return null;
      return {
        assetClass: asset.assetClass,
        monthlyRate: toMonthlyRate(catalogItem.expectedAnnualReturn),
        monthlyDy: toMonthlyDy(catalogItem.dividendYield12m),
        value: 0,
      };
    })
    .filter(Boolean) as Array<{
    assetClass: "FII" | "STOCK" | "ETF";
    monthlyRate: number;
    monthlyDy: number;
    value: number;
  }>;

  if (!assetStates.length) return [];

  const timeline: PortfolioTimelinePoint[] = [];
  let investedTotal = 0;

  for (let month = 1; month <= months; month += 1) {
    let portfolioValue = 0;
    let monthIncome = 0;
    investedTotal += portfolio.monthlyContribution;

    for (const state of assetStates) {
      const growth = state.value * state.monthlyRate;
      const income = state.value * state.monthlyDy;

      state.value += perAssetContribution + growth;
      if (portfolio.reinvestDividends) {
        state.value += income;
      }

      portfolioValue += state.value;
      monthIncome += income;
    }

    timeline.push({
      month,
      invested: round2(investedTotal),
      estimatedValue: round2(portfolioValue),
      estimatedIncome: round2(monthIncome),
    });
  }

  return timeline;
}
