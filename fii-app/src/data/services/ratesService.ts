type BcbSeriesItem = {
  data: string;
  valor: string;
};

export type ReferenceRates = {
  savingsAnnual: number;
  fixedIncomeAnnual: number;
  fixedIncomeLabel: string;
  source: "BCB" | "FALLBACK";
  savingsDate?: string;
  fixedIncomeDate?: string;
};

export const FALLBACK_REFERENCE_RATES: ReferenceRates = {
  savingsAnnual: 6.17,
  fixedIncomeAnnual: 10.5,
  fixedIncomeLabel: "Renda fixa (100% CDI)",
  source: "FALLBACK",
};

const BCB_SERIES = {
  cdiDaily: 12,
  savingsMonthly: 195,
} as const;

const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

let memoryCache: { savedAt: number; data: ReferenceRates } | null = null;

function formatDateForBcb(value: Date): string {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();
  return `${day}/${month}/${year}`;
}

function toNumber(value: string): number | null {
  const normalized = String(value).replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function annualizeFromMonthlyPercent(monthlyPercent: number): number {
  const monthlyRate = monthlyPercent / 100;
  return (Math.pow(1 + monthlyRate, 12) - 1) * 100;
}

function annualizeFromDailyPercent(dailyPercent: number): number {
  const dailyRate = dailyPercent / 100;
  return (Math.pow(1 + dailyRate, 252) - 1) * 100;
}

async function fetchLatestSeriesValue(seriesId: number, daysBack: number): Promise<BcbSeriesItem> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const dateParam = encodeURIComponent(formatDateForBcb(startDate));
  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesId}` +
    `/dados?formato=json&dataInicial=${dateParam}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`BCB ${seriesId} HTTP ${response.status}`);
  }

  const payload = (await response.json()) as BcbSeriesItem[];
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error(`BCB ${seriesId} sem dados`);
  }

  const latest = [...payload].reverse().find((item) => toNumber(item.valor) !== null);
  if (!latest) {
    throw new Error(`BCB ${seriesId} valor invalido`);
  }

  return latest;
}

export async function getReferenceRates(): Promise<ReferenceRates> {
  const now = Date.now();
  if (memoryCache && now - memoryCache.savedAt <= CACHE_TTL_MS) {
    return memoryCache.data;
  }

  try {
    const [cdiDailyRaw, savingsMonthlyRaw] = await Promise.all([
      fetchLatestSeriesValue(BCB_SERIES.cdiDaily, 30),
      fetchLatestSeriesValue(BCB_SERIES.savingsMonthly, 120),
    ]);

    const cdiDailyPercent = toNumber(cdiDailyRaw.valor);
    const savingsMonthlyPercent = toNumber(savingsMonthlyRaw.valor);

    if (cdiDailyPercent === null || savingsMonthlyPercent === null) {
      throw new Error("BCB retornou valor invalido");
    }

    const data: ReferenceRates = {
      savingsAnnual: annualizeFromMonthlyPercent(savingsMonthlyPercent),
      fixedIncomeAnnual: annualizeFromDailyPercent(cdiDailyPercent),
      fixedIncomeLabel: "Renda fixa (100% CDI)",
      source: "BCB",
      savingsDate: savingsMonthlyRaw.data,
      fixedIncomeDate: cdiDailyRaw.data,
    };

    memoryCache = { savedAt: now, data };
    return data;
  } catch {
    return FALLBACK_REFERENCE_RATES;
  }
}
