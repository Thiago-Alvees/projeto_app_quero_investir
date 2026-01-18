export type Fii = {
  ticker: string;
  price: number;

  // Fundamento para calcular P/VP dinamicamente
  vp?: number; // valor patrimonial por cota

  // Opcional: se não houver vp, podemos manter pvp fixo
  pvp?: number;

  dividendYield12m: number; // % ao ano
  pl?: number;
};
