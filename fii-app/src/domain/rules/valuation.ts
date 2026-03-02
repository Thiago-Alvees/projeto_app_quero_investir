export type ValuationStatus = "ATRATIVO" | "JUSTO" | "ESTICADO" | "INDEFINIDO";

export const PVP_ATTRACTIVE_MAX = 0.95;
export const PVP_FAIR_MAX = 1.1;
export const PVP_REFERENCE = 1;

export function getValuationStatus(pvp: number): ValuationStatus {
  if (!Number.isFinite(pvp) || pvp <= 0) return "INDEFINIDO";
  if (pvp < PVP_ATTRACTIVE_MAX) return "ATRATIVO";
  if (pvp <= PVP_FAIR_MAX) return "JUSTO";
  return "ESTICADO";
}

export type ValuationBreakdown = {
  status: Exclude<ValuationStatus, "INDEFINIDO">;
  rangeLabel: string;
  distanceToReference: number;
  reference: number;
  direction: "ABAIXO" | "ACIMA" | "EM_LINHA";
};

export function getValuationBreakdown(pvp: number): ValuationBreakdown | null {
  const status = getValuationStatus(pvp);
  if (status === "INDEFINIDO") return null;

  const direction =
    pvp === PVP_REFERENCE ? "EM_LINHA" : pvp < PVP_REFERENCE ? "ABAIXO" : "ACIMA";

  const rangeLabel =
    status === "ATRATIVO"
      ? `P/VP < ${PVP_ATTRACTIVE_MAX.toFixed(2)}`
      : status === "JUSTO"
        ? `${PVP_ATTRACTIVE_MAX.toFixed(2)} <= P/VP <= ${PVP_FAIR_MAX.toFixed(2)}`
        : `P/VP > ${PVP_FAIR_MAX.toFixed(2)}`;

  return {
    status,
    rangeLabel,
    distanceToReference: Math.abs(pvp - PVP_REFERENCE),
    reference: PVP_REFERENCE,
    direction,
  };
}

function describeDy(dy12m: number, dyStatus: "OK" | "APURACAO" = "APURACAO"): string {
  if (!Number.isFinite(dy12m)) {
    return dyStatus === "APURACAO"
      ? "um Dividend Yield em apuração"
      : "um Dividend Yield indisponível";
  }

  if (dy12m >= 8) return "um Dividend Yield atrativo";
  if (dy12m >= 6) return "um Dividend Yield na média";
  return "um Dividend Yield abaixo da média";
}

export function getValuationMessage(
  status: ValuationStatus,
  dy12m: number,
  dyStatus: "OK" | "APURACAO" = "APURACAO"
): string {
  const dyLevel = describeDy(dy12m, dyStatus);

  switch (status) {
    case "ATRATIVO":
      return `O fundo está abaixo do valor patrimonial e apresenta ${dyLevel}.`;
    case "JUSTO":
      return `O fundo está próximo do valor patrimonial e apresenta ${dyLevel}.`;
    case "ESTICADO":
      return `O fundo está acima do valor patrimonial e apresenta ${dyLevel}.`;
    case "INDEFINIDO":
      if (!Number.isFinite(dy12m)) {
        return dyStatus === "APURACAO"
          ? "Dados insuficientes para avaliar P/VP. DY em apuração."
          : "Dados insuficientes para avaliar P/VP. DY indisponível.";
      }
      return "Dados insuficientes para avaliar P/VP. Considere DY e qualidade do fundo.";
  }
}
