export type PortfolioVisibility = "PUBLICA" | "PRIVADA";

export type PortfolioAssetRef = {
  ticker: string;
  assetClass: "FII" | "STOCK" | "ETF";
};

export type InvestmentPortfolio = {
  id: string;
  name: string;
  visibility: PortfolioVisibility;
  monthlyContribution: number;
  months: number;
  reinvestDividends: boolean;
  assets: PortfolioAssetRef[];
  createdAt: string;
  updatedAt: string;
  shareCode?: string | null;
  ownerId?: string | null;
};

export type PortfolioProjectionItem = {
  ticker: string;
  assetClass: "FII" | "STOCK" | "ETF";
  monthlyContribution: number;
  invested: number;
  finalValue: number;
  gain: number;
  monthlyIncomeAtEnd: number;
};

export type PortfolioProjection = {
  invested: number;
  finalValue: number;
  gain: number;
  monthlyIncomeAtEnd: number;
  items: PortfolioProjectionItem[];
};

export type PortfolioTimelinePoint = {
  month: number;
  invested: number;
  estimatedValue: number;
  estimatedIncome: number;
};
