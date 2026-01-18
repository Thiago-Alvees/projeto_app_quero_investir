export type ValuationStatus = "ATRATIVO" | "JUSTO" | "ESTICADO";

export function getValuationStatus(pvp: number): ValuationStatus {
  if (pvp < 0.95) return "ATRATIVO";
  if (pvp <= 1.1) return "JUSTO";
  return "ESTICADO";
}

export function getValuationMessage(status: ValuationStatus, dy12m: number): string {
  // DY como reforço na mensagem (sem mudar status)
  const dyLevel =
    dy12m >= 8 ? "um Dividend Yield atrativo" :
    dy12m >= 6 ? "um Dividend Yield na média" :
    "um Dividend Yield abaixo da média";

  switch (status) {
    case "ATRATIVO":
      return `O fundo está sendo negociado abaixo do valor patrimonial e apresenta ${dyLevel}.`;
    case "JUSTO":
      return `O fundo está próximo do valor patrimonial e apresenta ${dyLevel}.`;
    case "ESTICADO":
      return `O fundo está acima do valor patrimonial e apresenta ${dyLevel}.`;
  }
}
