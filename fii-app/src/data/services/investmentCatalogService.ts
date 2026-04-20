import type { Fii } from "../../domain/models/fii";
import { getFiiList } from "./fiiService";
import { getMarketAssets } from "./marketService";
import {
  INVESTMENT_CATALOG,
  INVESTMENT_CATALOG_BY_KEY,
  type PortfolioAssetCatalogItem,
} from "../mock/investmentCatalog";

export type InvestmentCatalogResult = {
  items: PortfolioAssetCatalogItem[];
  byKey: Map<string, PortfolioAssetCatalogItem>;
  source: "SNAPSHOT" | "FALLBACK";
  updatedAt: string | null;
};

function toKey(assetClass: string, ticker: string): string {
  return `${assetClass}:${ticker}`;
}

function mapFiiToCatalog(
  fii: Fii,
  priceUpdatedAt: string | null
): PortfolioAssetCatalogItem {
  const dy = Number.isFinite(fii.dividendYield12m) ? fii.dividendYield12m : 0;
  const pvp =
    typeof fii.vp === "number" && Number.isFinite(fii.vp) && fii.vp > 0
      ? fii.price / fii.vp
      : fii.pvp;

  return {
    ticker: fii.ticker,
    assetClass: "FII",
    name: `${fii.ticker} - Fundo Imobiliário`,
    category: fii.type,
    price: Number.isFinite(fii.price) ? fii.price : 0,
    priceUpdatedAt,
    dividendYield12m: Number.isFinite(dy) ? dy : 0,
    expectedAnnualReturn: Math.max(8, Number.isFinite(dy) ? dy + 2 : 10),
    pvp,
    pl: fii.pl,
  };
}

export async function getInvestmentCatalog(options: {
  force: boolean;
}): Promise<InvestmentCatalogResult> {
  try {
    const [fiiResult, marketResult] = await Promise.all([
      getFiiList({ force: options.force }),
      getMarketAssets({ force: options.force }),
    ]);

    const items: PortfolioAssetCatalogItem[] = [];
    let latestDateMs = 0;

    if (fiiResult.ok) {
      for (const fii of fiiResult.data) {
        items.push(mapFiiToCatalog(fii, fiiResult.updatedAt ?? null));
      }
      if (fiiResult.updatedAt) {
        latestDateMs = Math.max(latestDateMs, new Date(fiiResult.updatedAt).getTime());
      }
      if (fiiResult.fundamentalsUpdatedAt) {
        latestDateMs = Math.max(
          latestDateMs,
          new Date(fiiResult.fundamentalsUpdatedAt).getTime()
        );
      }
    }

    if (marketResult.ok) {
      for (const asset of marketResult.data) {
        const tickerKey = asset.ticker.toUpperCase();
        const priceUpdatedAt =
          marketResult.priceUpdatedAtByTicker[tickerKey] ?? marketResult.updatedAt ?? null;

        items.push({
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          name: asset.name,
          category: asset.category,
          price: asset.price,
          priceUpdatedAt,
          dividendYield12m:
            typeof asset.dividendYield12m === "number" && Number.isFinite(asset.dividendYield12m)
              ? asset.dividendYield12m
              : 0,
          expectedAnnualReturn: asset.expectedAnnualReturn,
          pvp: asset.pvp,
          pl: asset.pl,
          expenseRatio: asset.expenseRatio,
        });
      }
      if (marketResult.updatedAt) {
        latestDateMs = Math.max(latestDateMs, new Date(marketResult.updatedAt).getTime());
      }
    }

    if (!items.length) {
      return {
        items: INVESTMENT_CATALOG,
        byKey: new Map(INVESTMENT_CATALOG_BY_KEY),
        source: "FALLBACK",
        updatedAt: null,
      };
    }

    const dedupedMap = new Map<string, PortfolioAssetCatalogItem>();
    for (const item of items) {
      dedupedMap.set(toKey(item.assetClass, item.ticker), item);
    }

    const dedupedItems = Array.from(dedupedMap.values()).sort((a, b) => {
      if (a.assetClass === b.assetClass) return a.ticker.localeCompare(b.ticker);
      return a.assetClass.localeCompare(b.assetClass);
    });

    return {
      items: dedupedItems,
      byKey: dedupedMap,
      source:
        fiiResult.ok &&
        fiiResult.source === "SNAPSHOT" &&
        marketResult.ok &&
        marketResult.source === "SNAPSHOT"
          ? "SNAPSHOT"
          : "FALLBACK",
      updatedAt: latestDateMs > 0 ? new Date(latestDateMs).toISOString() : null,
    };
  } catch (error) {
    if (__DEV__) console.log("[catalog] fallback local:", String(error));
    return {
      items: INVESTMENT_CATALOG,
      byKey: new Map(INVESTMENT_CATALOG_BY_KEY),
      source: "FALLBACK",
      updatedAt: null,
    };
  }
}
