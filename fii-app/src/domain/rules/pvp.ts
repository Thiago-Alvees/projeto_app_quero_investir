import type { Fii } from "../models/fii";

export function computePvp(fii: Fii): number {
  // Prioridade 1: se temos VP, calculamos dinamicamente
  if (
    typeof fii.price === "number" &&
    Number.isFinite(fii.price) &&
    fii.price > 0 &&
    typeof fii.vp === "number" &&
    Number.isFinite(fii.vp) &&
    fii.vp > 0
  ) {
    return fii.price / fii.vp;
  }

  // Prioridade 2: fallback para P/VP fixo
  if (typeof fii.pvp === "number" && Number.isFinite(fii.pvp) && fii.pvp > 0) {
    return fii.pvp;
  }

  // Sem dados suficientes para calcular
  return Number.NaN;
}
