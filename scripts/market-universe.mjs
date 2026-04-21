export const STOCK_TICKERS = [
  "PETR4",
  "B3SA3",
  "CPLE3",
  "ITSA4",
  "VAMO3",
  "CSAN3",
  "BBDC4",
  "ITUB4",
  "VALE3",
  "ABEV3",
  "MGLU3",
  "BBAS3",
  "ASAI3",
  "PRIO3",
  "BRAV3",
  "AXIA3",
  "LREN3",
  "CMIG4",
  "RUMO3",
  "PETR3",
  "RADL3",
  "AXIA7",
  "GGBR4",
  "ENEV3",
  "ALOS3",
  "MRFG3",
  "EQTL3",
  "SMFT3",
  "RDOR3",
  "TOTS3",
  "RENT3",
  "SBSP3",
  "WEGE3",
  "VBBR3",
  "BPAC11",
  "SUZB3",
  "EMBR3",
  "SANB11",
  "CSMG3",
  "BBSE3",
  "SAPR11",
  "VIVT3",
  "PORT3",
  "ENGI11",
  "CPFE3",
];

export const ETF_TICKERS = [
  "SMAL11",
  "BOVA11",
  "GOLD11",
  "LFTB11",
  "NASD11",
  "BOVX11",
  "HASH11",
  "ETHE11",
  "COIN11",
  "QBTC11",
  "LFTS11",
  "BOVV11",
  "DEBB11",
  "XINA11",
  "QSOL11",
  "TECK11",
  "BITH11",
  "SPXR11",
  "BIWF39",
  "SPXI11",
  "IVVB11",
  "DVER11",
  "B5P211",
  "AUPO11",
  "DOLA11",
  "GOLD11T",
  "PACB11",
  "BITI11",
  "QETH11",
  "SOLH11",
  "ACWI11",
  "BSLV39",
  "UTEC11",
  "SPYI11",
  "WRLD11",
  "USAL11",
  "DIVO11",
  "ETHY11",
  "NTNS11",
  "IMAB11",
  "BCPX39",
  "HODL11",
  "REVE11",
  "IRFM11",
  "BIEI39",
  "BURA39",
  "USDB11",
  "USTK11",
  "IBIT39",
  "QQQI11",
  "HTEK11",
  "XRPH11",
  "IBOB11",
  "IB5M11",
  "XFIX11",
  "SPXB11",
  "DIVD11",
  "BIVB39",
  "PACG11",
  "MILL11",
  "HIGH11",
  "PIPE11",
  "LFIN11",
  "CHIP11",
  "BAAX39",
  "OURO11",
  "BTLT39",
  "NDIV11",
  "GOLX11",
  "BSIL39",
  "BOVB11",
  "GLDI11",
  "FIND11",
  "NLFA11",
  "HYBR11",
  "BHER39",
  "GENB11",
  "FIXA11",
  "ALUG11",
  "WEB311",
  "SILK11",
  "IDKA11",
  "DEFI11",
  "GDIV11",
  "GPUS11",
  "BSHV39",
  "BBUG39",
  "TIRB11",
  "UTLL11",
  "AUVP11",
  "BIAU39",
  "QDFI11",
  "BEWY39",
  "QLBR11",
  "HGBR11",
  "VWRA11",
  "CRPT11",
  "BOEF39",
  "BRAX11",
  "BIXJ39",
  "ABGD39",
  "LVOL11",
  "MARG11",
  "BIEM39",
  "PACL11",
];

const OVERRIDES = {
  ITUB4: {
    cvmCode: 19348,
    name: "Itaú Unibanco PN",
    category: "Financeiro",
    expectedAnnualReturn: 13.5,
  },
  BBAS3: {
    cvmCode: 1023,
    name: "Banco do Brasil ON",
    category: "Financeiro",
    expectedAnnualReturn: 14.2,
  },
  WEGE3: {
    cvmCode: 5410,
    name: "WEG ON",
    category: "Industrial",
    expectedAnnualReturn: 11.8,
  },
  TAEE11: {
    cvmCode: 20257,
    name: "Taesa Unit",
    category: "Energia",
    expectedAnnualReturn: 12.4,
  },
  PETR4: {
    cvmCode: 9512,
    name: "Petrobras PN",
    category: "Petróleo e Gás",
    expectedAnnualReturn: 15.3,
  },
  B3SA3: {
    cvmCode: 21610,
    name: "B3 ON",
    category: "Financeiro",
    expectedAnnualReturn: 11.2,
  },
  BOVA11: {
    name: "iShares Ibovespa",
    category: "Ibovespa",
    expenseRatio: 0.3,
    expectedAnnualReturn: 11.6,
  },
  SMAL11: {
    name: "iShares Small Caps",
    category: "Small Caps",
    expenseRatio: 0.5,
    expectedAnnualReturn: 13.1,
  },
  IVVB11: {
    name: "iShares S&P 500",
    category: "S&P 500",
    expenseRatio: 0.24,
    expectedAnnualReturn: 10.8,
  },
  XFIX11: {
    name: "Trend IFIX",
    category: "IFIX",
    expenseRatio: 0.35,
    expectedAnnualReturn: 10.1,
  },
};

function normalizeTicker(value) {
  return String(value ?? "").toUpperCase().trim();
}

function mergeWithOverride(base, override) {
  if (!override) return base;
  return {
    ...base,
    ...override,
    ticker: base.ticker,
    assetClass: base.assetClass,
  };
}

export const MARKET_UNIVERSE = (() => {
  const output = [];
  const seen = new Set();

  const add = (ticker, assetClass) => {
    const normalized = normalizeTicker(ticker);
    if (!normalized) return;
    const key = `${assetClass}:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);

    const base = {
      ticker: normalized,
      assetClass,
      category: assetClass === "STOCK" ? "Ações" : "ETFs",
      expectedAnnualReturn: assetClass === "STOCK" ? 12 : 10,
    };

    output.push(mergeWithOverride(base, OVERRIDES[normalized]));
  };

  for (const ticker of STOCK_TICKERS) add(ticker, "STOCK");
  for (const ticker of ETF_TICKERS) add(ticker, "ETF");

  output.sort((a, b) => {
    if (a.assetClass === b.assetClass) return a.ticker.localeCompare(b.ticker);
    return a.assetClass.localeCompare(b.assetClass);
  });

  return output;
})();
