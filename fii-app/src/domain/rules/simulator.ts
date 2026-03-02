export type BasicProjection = {
  totalInvested: number;
  finalValue: number;
  totalGain: number;
  monthlyIncomeAtEnd: number;
};

export type FiiProjection = BasicProjection & {
  shares: number;
  cash: number;
  totalDividends: number;
  monthlyIncome: number;
};

type RecurringContributionInput = {
  monthlyContribution: number;
  months: number;
  annualRate: number;
};

type FiiSimulationInput = {
  monthlyContribution: number;
  months: number;
  price: number;
  dyAnnual: number;
  reinvestDividends: boolean;
};

function annualRateToMonthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
}

function sanitizeMonths(value: number): number {
  return Math.max(1, Math.floor(value));
}

export function simulateRecurringContribution(
  input: RecurringContributionInput
): BasicProjection | null {
  const { monthlyContribution, months, annualRate } = input;
  if (!Number.isFinite(monthlyContribution) || monthlyContribution <= 0) return null;
  if (!Number.isFinite(months) || months <= 0) return null;
  if (!Number.isFinite(annualRate) || annualRate <= 0) return null;

  const totalMonths = sanitizeMonths(months);
  const monthlyRate = annualRateToMonthlyRate(annualRate);

  let balance = 0;

  for (let month = 1; month <= totalMonths; month += 1) {
    balance += monthlyContribution;
    balance *= 1 + monthlyRate;
  }

  const totalInvested = monthlyContribution * totalMonths;
  const totalGain = balance - totalInvested;
  const monthlyIncomeAtEnd = balance * monthlyRate;

  return {
    totalInvested,
    finalValue: balance,
    totalGain,
    monthlyIncomeAtEnd,
  };
}

export function simulateFiiRecurringContribution(
  input: FiiSimulationInput
): FiiProjection | null {
  const { monthlyContribution, months, price, dyAnnual, reinvestDividends } = input;

  if (!Number.isFinite(monthlyContribution) || monthlyContribution <= 0) return null;
  if (!Number.isFinite(months) || months <= 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(dyAnnual) || dyAnnual <= 0) return null;

  const totalMonths = sanitizeMonths(months);
  const monthlyDividendPerShare = (price * (dyAnnual / 100)) / 12;

  let shares = 0;
  let cash = 0;
  let totalDividends = 0;

  for (let month = 1; month <= totalMonths; month += 1) {
    cash += monthlyContribution;

    const purchasableShares = Math.floor(cash / price);
    if (purchasableShares > 0) {
      shares += purchasableShares;
      cash -= purchasableShares * price;
    }

    const monthlyDividend = shares * monthlyDividendPerShare;
    totalDividends += monthlyDividend;

    if (reinvestDividends) {
      cash += monthlyDividend;
    }
  }

  if (shares <= 0) return null;

  const totalInvested = monthlyContribution * totalMonths;
  const sharesValue = shares * price;
  const finalValue = reinvestDividends
    ? sharesValue + cash
    : sharesValue + cash + totalDividends;
  const totalGain = finalValue - totalInvested;
  const monthlyIncome = shares * monthlyDividendPerShare;

  return {
    totalInvested,
    finalValue,
    totalGain,
    monthlyIncomeAtEnd: monthlyIncome,
    shares,
    cash,
    totalDividends,
    monthlyIncome,
  };
}
