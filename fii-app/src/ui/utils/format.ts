const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrencyBRL(value: number): string {
  if (!Number.isFinite(value)) return "R$ 0,00";
  return currencyFormatter.format(value);
}

export function formatDecimalBR(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
