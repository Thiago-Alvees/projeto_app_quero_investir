import type { Fii } from "../models/fii";
import type { MarketAnalysis, MarketAsset } from "../models/marketAsset";
import type { ValuationStatus } from "./valuation";

type ScoreStatus = ValuationStatus | MarketAnalysis["status"];

export type ScoreBreakdown = {
  score: number;
  label: "Excelente" | "Bom" | "Moderado" | "Cautela";
  reasons: string[];
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreLabel(score: number): ScoreBreakdown["label"] {
  if (score >= 80) return "Excelente";
  if (score >= 65) return "Bom";
  if (score >= 45) return "Moderado";
  return "Cautela";
}

function baseScoreFromStatus(status: ScoreStatus): number {
  if (status === "ATRATIVO") return 82;
  if (status === "JUSTO") return 64;
  if (status === "ESTICADO") return 36;
  return 50;
}

export function buildFiiScore(input: {
  fii: Fii;
  pvp: number;
  status: ValuationStatus;
}): ScoreBreakdown {
  const { fii, pvp, status } = input;
  let score = baseScoreFromStatus(status);
  const reasons: string[] = [];

  if (Number.isFinite(pvp)) {
    if (pvp < 0.95) {
      score += 8;
      reasons.push("P/VP abaixo de 0,95 reforça preço atrativo.");
    } else if (pvp <= 1.1) {
      reasons.push("P/VP em faixa de preço justo.");
    } else {
      score -= 10;
      reasons.push("P/VP acima de 1,10 reduz margem de segurança.");
    }
  } else {
    score -= 8;
    reasons.push("P/VP indisponível reduz confiança da análise.");
  }

  const dy = Number.isFinite(fii.dividendYield12m) ? fii.dividendYield12m : null;
  if (dy !== null) {
    if (dy >= 8) {
      score += 6;
      reasons.push("DY de 12 meses acima de 8% fortalece potencial de renda.");
    } else if (dy >= 6) {
      reasons.push("DY de 12 meses em faixa intermediária.");
    } else {
      score -= 4;
      reasons.push("DY de 12 meses mais baixo pede cautela.");
    }
  } else {
    reasons.push("DY em apuração; revise novamente quando houver atualização.");
  }

  if (!(typeof fii.pl === "number" && Number.isFinite(fii.pl) && fii.pl > 0)) {
    score -= 3;
  }

  const normalized = clampScore(score);
  return {
    score: normalized,
    label: scoreLabel(normalized),
    reasons,
  };
}

export function buildMarketAssetScore(input: {
  asset: MarketAsset;
  analysis: MarketAnalysis;
}): ScoreBreakdown {
  const { asset, analysis } = input;
  let score = baseScoreFromStatus(analysis.status);
  const reasons: string[] = [analysis.ruleLabel];

  if (asset.assetClass === "ETF") {
    if (typeof asset.expenseRatio === "number" && Number.isFinite(asset.expenseRatio)) {
      if (asset.expenseRatio <= 0.35) {
        score += 6;
        reasons.push("Taxa de administração baixa.");
      } else if (asset.expenseRatio > 0.8) {
        score -= 6;
        reasons.push("Taxa de administração alta.");
      }
    }
  } else {
    if (typeof asset.pvp === "number" && Number.isFinite(asset.pvp)) {
      if (asset.pvp < 1) score += 4;
      if (asset.pvp > 2.3) score -= 6;
    }
    if (typeof asset.pl === "number" && Number.isFinite(asset.pl) && asset.pl > 0) {
      if (asset.pl < 12) score += 5;
      if (asset.pl > 25) score -= 6;
    }
  }

  if (typeof asset.dividendYield12m === "number" && Number.isFinite(asset.dividendYield12m)) {
    if (asset.dividendYield12m >= 8) score += 3;
  }

  const normalized = clampScore(score);
  return {
    score: normalized,
    label: scoreLabel(normalized),
    reasons,
  };
}

export type FiiRadarItem = {
  ticker: string;
  dy: number;
  pvp: number | null;
  price: number;
};

export function buildFiiRadar(fiis: Array<Fii & { pvp: number }>): {
  topDividend: FiiRadarItem[];
  topDiscount: FiiRadarItem[];
} {
  const normalized: FiiRadarItem[] = fiis
    .filter((fii) => Number.isFinite(fii.price) && fii.price > 0)
    .map((fii) => ({
      ticker: fii.ticker,
      dy: Number.isFinite(fii.dividendYield12m) ? fii.dividendYield12m : 0,
      pvp: Number.isFinite(fii.pvp) ? fii.pvp : null,
      price: fii.price,
    }));

  const topDividend = [...normalized]
    .filter((item) => item.dy > 0)
    .sort((a, b) => b.dy - a.dy)
    .slice(0, 5);

  const topDiscount = [...normalized]
    .filter((item) => item.pvp !== null)
    .sort((a, b) => (a.pvp ?? 99) - (b.pvp ?? 99))
    .slice(0, 5);

  return { topDividend, topDiscount };
}
