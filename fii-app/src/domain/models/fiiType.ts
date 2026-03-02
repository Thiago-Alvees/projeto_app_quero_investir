export const FII_TYPES = [
  "Logistica",
  "Shoppings",
  "Lajes",
  "Papel/CRI",
  "Hibridos/Outros",
] as const;

export type FiiType = (typeof FII_TYPES)[number];
