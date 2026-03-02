import type { FiiType } from "./fiiType";

export type Fii = {
  ticker: string;
  type: FiiType;
  price: number;

  // Used to calculate P/VP dynamically when available.
  vp?: number;

  // Fallback P/VP when VP is unavailable.
  pvp?: number;

  // Annual dividend yield (12 months). May be NaN when unavailable.
  dividendYield12m: number;

  // Indicates if DY is available or still being calculated.
  dyStatus?: "OK" | "APURACAO";

  // Total net equity in BRL.
  pl?: number;
};
