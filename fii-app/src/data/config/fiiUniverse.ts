export const FII_TICKERS = ["HGLG11", "MXRF11", "KNRI11", "VISC11", "XPLG11"] as const;
export type FiiTicker = (typeof FII_TICKERS)[number];
