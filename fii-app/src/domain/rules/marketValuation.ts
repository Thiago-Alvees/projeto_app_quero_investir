import type { MarketAnalysis, MarketAsset } from "../models/marketAsset";

function analyzeStock(asset: MarketAsset): MarketAnalysis {
  const pl = typeof asset.pl === "number" && Number.isFinite(asset.pl) ? asset.pl : null;
  const pvp = typeof asset.pvp === "number" && Number.isFinite(asset.pvp) ? asset.pvp : null;
  const dy = typeof asset.dividendYield12m === "number" && Number.isFinite(asset.dividendYield12m)
    ? asset.dividendYield12m
    : null;

  if (pl === null && pvp === null) {
    return {
      status: "INDEFINIDO",
      ruleLabel: "Sem P/L e P/VP suficientes",
      summary: "Dados insuficientes para classificar este ativo com segurança.",
    };
  }

  if ((pl !== null && pl <= 12) && (pvp !== null && pvp <= 1.4)) {
    return {
      status: "ATRATIVO",
      ruleLabel: "P/L <= 12 e P/VP <= 1,40",
      summary: "A ação combina lucro relativo e preço patrimonial mais equilibrados.",
    };
  }

  if ((pl !== null && pl <= 20) && (pvp !== null && pvp <= 2.2)) {
    return {
      status: "JUSTO",
      ruleLabel: "P/L <= 20 e P/VP <= 2,20",
      summary: "A ação está em faixa intermediária de preço para os indicadores atuais.",
    };
  }

  if (dy !== null && dy >= 8 && pvp !== null && pvp <= 1.8) {
    return {
      status: "JUSTO",
      ruleLabel: "DY alto com P/VP moderado",
      summary: "Mesmo com preço mais exigente, o DY ajuda a equilibrar a análise.",
    };
  }

  return {
    status: "ESTICADO",
    ruleLabel: "Preço acima da faixa de conforto",
    summary: "Os múltiplos estão mais altos e pedem maior cautela para entrada.",
  };
}

function analyzeEtf(asset: MarketAsset): MarketAnalysis {
  const fee =
    typeof asset.expenseRatio === "number" && Number.isFinite(asset.expenseRatio)
      ? asset.expenseRatio
      : null;
  const expected =
    typeof asset.expectedAnnualReturn === "number" && Number.isFinite(asset.expectedAnnualReturn)
      ? asset.expectedAnnualReturn
      : null;

  if (fee === null || expected === null) {
    return {
      status: "INDEFINIDO",
      ruleLabel: "Sem taxa e retorno esperados",
      summary: "Dados insuficientes para avaliar custo e potencial do ETF.",
    };
  }

  if (fee <= 0.35 && expected >= 10) {
    return {
      status: "ATRATIVO",
      ruleLabel: "Taxa <= 0,35% e retorno esperado >= 10% a.a.",
      summary: "ETF com custo baixo e expectativa de retorno competitiva.",
    };
  }

  if (fee <= 0.75 && expected >= 8) {
    return {
      status: "JUSTO",
      ruleLabel: "Taxa <= 0,75% e retorno esperado >= 8% a.a.",
      summary: "ETF com relação custo/retorno razoável para diversificação.",
    };
  }

  return {
    status: "ESTICADO",
    ruleLabel: "Custo alto ou retorno esperado baixo",
    summary: "O custo do ETF pesa mais e reduz o potencial líquido.",
  };
}

export function analyzeMarketAsset(asset: MarketAsset): MarketAnalysis {
  return asset.assetClass === "STOCK" ? analyzeStock(asset) : analyzeEtf(asset);
}

