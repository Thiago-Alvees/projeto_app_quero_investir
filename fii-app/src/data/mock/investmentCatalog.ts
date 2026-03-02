import { FIIS_MOCK } from "./fiis";
import { MARKET_ASSETS_MOCK } from "./marketAssets";
import { FII_TYPE_BY_TICKER, FII_UNIVERSE } from "../static/fiiUniverse";

export type PortfolioAssetCatalogItem = {
  ticker: string;
  assetClass: "FII" | "STOCK" | "ETF";
  name: string;
  category: string;
  price: number;
  priceUpdatedAt?: string | null;
  dividendYield12m: number;
  expectedAnnualReturn: number;
  pvp?: number;
  pl?: number;
  expenseRatio?: number;
};

const fiiMockByTicker = new Map(FIIS_MOCK.map((item) => [item.ticker, item]));

const FII_CATALOG: PortfolioAssetCatalogItem[] = FII_UNIVERSE.map((ticker) => {
  const mock = fiiMockByTicker.get(ticker);
  const dy =
    mock && Number.isFinite(mock.dividendYield12m) ? mock.dividendYield12m : Number.NaN;

  return {
    ticker,
    assetClass: "FII",
    name: `${ticker} - Fundo Imobiliário`,
    category: FII_TYPE_BY_TICKER[ticker],
    price: mock?.price ?? 0,
    priceUpdatedAt: null,
    dividendYield12m: Number.isFinite(dy) ? dy : 0,
    expectedAnnualReturn: Math.max(8, Number.isFinite(dy) ? dy + 2 : 10),
    pvp: mock?.vp && mock.vp > 0 ? mock.price / mock.vp : mock?.pvp,
    pl: mock?.pl,
  };
});

const MARKET_CATALOG: PortfolioAssetCatalogItem[] = MARKET_ASSETS_MOCK.map((item) => ({
  ticker: item.ticker,
  assetClass: item.assetClass,
  name: item.name,
  category: item.category,
  price: item.price,
  priceUpdatedAt: null,
  dividendYield12m:
    typeof item.dividendYield12m === "number" && Number.isFinite(item.dividendYield12m)
      ? item.dividendYield12m
      : 0,
  expectedAnnualReturn: item.expectedAnnualReturn,
  pvp: item.pvp,
  pl: item.pl,
  expenseRatio: item.expenseRatio,
}));

export const INVESTMENT_CATALOG: PortfolioAssetCatalogItem[] = [
  ...FII_CATALOG,
  ...MARKET_CATALOG,
];

export const INVESTMENT_CATALOG_BY_KEY = new Map(
  INVESTMENT_CATALOG.map((item) => [`${item.assetClass}:${item.ticker}`, item])
);

