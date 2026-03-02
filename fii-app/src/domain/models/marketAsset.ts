export type MarketAssetClass = "STOCK" | "ETF";

export type MarketStatus = "ATRATIVO" | "JUSTO" | "ESTICADO" | "INDEFINIDO";

export type MarketAsset = {
  ticker: string;
  assetClass: MarketAssetClass;
  name: string;
  category: string;
  price: number;
  priceUpdatedAt?: string | null;
  pvp?: number;
  pl?: number;
  dividendYield12m?: number;
  expenseRatio?: number;
  expectedAnnualReturn: number;
};

export type MarketAnalysis = {
  status: MarketStatus;
  summary: string;
  ruleLabel: string;
};
