import React, { useMemo, useState } from "react";
import { Switch, Text, TextInput, View } from "react-native";

import {
  simulateFiiRecurringContribution,
  simulateRecurringContribution,
} from "../../../domain/rules/simulator";
import { useReferenceRates } from "../../hooks/useReferenceRates";
import { formatCurrencyBRL, formatDecimalBR } from "../../utils/format";
import { normalizeUtf8Text } from "../../utils/text";
import { assetDetailStyles as styles } from "./styles";

function parseNumberInput(value: string): number | null {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

type Props = {
  assetLabel: string;
  hint: string;
  price: number;
  dividendYield12m?: number | null;
  dyStatus?: "OK" | "APURACAO";
  defaultMonthlyContribution?: string;
  defaultMonths?: string;
};

export default function AssetSimulationComparison({
  assetLabel,
  hint,
  price,
  dividendYield12m,
  dyStatus = "OK",
  defaultMonthlyContribution = "500",
  defaultMonths = "24",
}: Props) {
  const { rates, loading: ratesLoading } = useReferenceRates();

  const [monthlyContributionInput, setMonthlyContributionInput] = useState(defaultMonthlyContribution);
  const [monthsInput, setMonthsInput] = useState(defaultMonths);
  const [reinvestDividends, setReinvestDividends] = useState(true);

  const hasPrice = Number.isFinite(price) && price > 0;
  const dyValue =
    typeof dividendYield12m === "number" && Number.isFinite(dividendYield12m) ? dividendYield12m : NaN;
  const hasDy = dyStatus !== "APURACAO" && Number.isFinite(dyValue) && dyValue > 0;

  const dyUnavailableReason =
    dyStatus === "APURACAO" ? "o DY estiver em apuração" : "o DY estiver indisponível";

  const assetSimulationUnavailableReason = !hasDy
    ? dyUnavailableReason
    : !hasPrice
      ? "a cotação estiver indisponível"
      : "faltarem dados para simular";

  const simulation = useMemo(() => {
    const monthlyContribution = parseNumberInput(monthlyContributionInput);
    const months = parseNumberInput(monthsInput);

    if (
      monthlyContribution === null ||
      monthlyContribution <= 0 ||
      months === null ||
      months <= 0 ||
      !rates
    ) {
      return null;
    }

    const assetProjection = hasDy
      ? simulateFiiRecurringContribution({
          monthlyContribution,
          months,
          price,
          dyAnnual: dyValue,
          reinvestDividends,
        })
      : null;

    const savingsProjection = simulateRecurringContribution({
      monthlyContribution,
      months,
      annualRate: rates.savingsAnnual,
    });

    const fixedIncomeProjection = simulateRecurringContribution({
      monthlyContribution,
      months,
      annualRate: rates.fixedIncomeAnnual,
    });

    return {
      monthlyContribution,
      months: Math.max(1, Math.floor(months)),
      assetProjection,
      savingsProjection,
      fixedIncomeProjection,
    };
  }, [monthlyContributionInput, monthsInput, rates, hasDy, price, dyValue, reinvestDividends]);

  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>Simulador e comparativo</Text>
      <Text style={styles.simHint}>{hint}</Text>

      <TextInput
        value={monthlyContributionInput}
        onChangeText={setMonthlyContributionInput}
        keyboardType="numeric"
        placeholder="Aporte mensal (R$)"
        style={styles.input}
      />

      <TextInput
        value={monthsInput}
        onChangeText={setMonthsInput}
        keyboardType="numeric"
        placeholder="Tempo (meses)"
        style={styles.input}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Reinvestir dividendos automaticamente</Text>
        <Switch
          value={reinvestDividends}
          onValueChange={setReinvestDividends}
          trackColor={{ false: "#ccc", true: "#0a7a0a" }}
        />
      </View>

      {rates ? (
        <Text style={styles.rateInfo}>
          Taxas de referência: Poupança {formatDecimalBR(rates.savingsAnnual, 2)}% a.a. |
          {` ${normalizeUtf8Text(rates.fixedIncomeLabel)} ${formatDecimalBR(
            rates.fixedIncomeAnnual,
            2
          )}% a.a.`}
        </Text>
      ) : null}

      {rates && rates.source === "BCB" ? (
        <Text style={styles.rateInfo}>
          Fonte BCB: poupança {rates.savingsDate ?? "-"} | CDI {rates.fixedIncomeDate ?? "-"}
        </Text>
      ) : null}

      {ratesLoading ? <Text style={styles.rateInfo}>Atualizando taxas de mercado...</Text> : null}

      {!simulation ? (
        <Text style={styles.kpiMuted}>Preencha aporte mensal e tempo para calcular.</Text>
      ) : (
        <View style={styles.resultGroup}>
          <Text style={styles.simSummary}>
            Simulando {formatCurrencyBRL(simulation.monthlyContribution)} por mês durante{" "}
            {simulation.months} meses:
          </Text>

          {simulation.assetProjection ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>{assetLabel}</Text>
              <Text style={styles.resultLine}>
                Valor final estimado: {formatCurrencyBRL(simulation.assetProjection.finalValue)}
              </Text>
              <Text style={styles.resultLine}>
                Rendimento estimado: {formatCurrencyBRL(simulation.assetProjection.totalGain)}
              </Text>
              <Text style={styles.resultLine}>
                Renda mensal estimada ao final:{" "}
                {formatCurrencyBRL(simulation.assetProjection.monthlyIncome)}
              </Text>
            </View>
          ) : (
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>{assetLabel}</Text>
              <Text style={styles.resultLine}>
                Simulação indisponível enquanto {assetSimulationUnavailableReason}.
              </Text>
            </View>
          )}

          {simulation.savingsProjection ? (
            <View style={styles.resultBoxAlt}>
              <Text style={styles.resultTitle}>Poupança</Text>
              <Text style={styles.resultLine}>
                Valor final estimado: {formatCurrencyBRL(simulation.savingsProjection.finalValue)}
              </Text>
              <Text style={styles.resultLine}>
                Rendimento estimado: {formatCurrencyBRL(simulation.savingsProjection.totalGain)}
              </Text>
              <Text style={styles.resultLine}>
                Renda mensal estimada ao final:{" "}
                {formatCurrencyBRL(simulation.savingsProjection.monthlyIncomeAtEnd)}
              </Text>
            </View>
          ) : null}

          {simulation.fixedIncomeProjection ? (
            <View style={styles.resultBoxAlt}>
              <Text style={styles.resultTitle}>
                {normalizeUtf8Text(rates?.fixedIncomeLabel ?? "Renda fixa")}
              </Text>
              <Text style={styles.resultLine}>
                Valor final estimado: {formatCurrencyBRL(simulation.fixedIncomeProjection.finalValue)}
              </Text>
              <Text style={styles.resultLine}>
                Rendimento estimado: {formatCurrencyBRL(simulation.fixedIncomeProjection.totalGain)}
              </Text>
              <Text style={styles.resultLine}>
                Renda mensal estimada ao final:{" "}
                {formatCurrencyBRL(simulation.fixedIncomeProjection.monthlyIncomeAtEnd)}
              </Text>
            </View>
          ) : null}

          <Text style={styles.simDisclaimer}>
            Comparativo educativo. Não considera impostos, taxas, vacância ou variação real do
            mercado.
          </Text>
        </View>
      )}
    </View>
  );
}
