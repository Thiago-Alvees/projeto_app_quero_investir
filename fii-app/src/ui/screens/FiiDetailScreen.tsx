import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/AppNavigator";
import type { FiiDetail, FiiHistoryPoint } from "../../data/services/fiiService";
import HistorySparkline from "../components/HistorySparkline";
import { isFavorite as getIsFavorite, toggleFavorite } from "../../data/services/favoritesService";
import { computePvp } from "../../domain/rules/pvp";
import {
  getValuationBreakdown,
  getValuationMessage,
  getValuationStatus,
} from "../../domain/rules/valuation";
import {
  simulateFiiRecurringContribution,
  simulateRecurringContribution,
} from "../../domain/rules/simulator";
import { useFiiDetail } from "../hooks/useFiiDetail";
import { useReferenceRates } from "../hooks/useReferenceRates";
import { formatCurrencyBRL, formatDecimalBR } from "../utils/format";
import { normalizeUtf8Text } from "../utils/text";

type Props = NativeStackScreenProps<RootStackParamList, "FiiDetail">;

const EMPTY_DETAIL: FiiDetail = {
  history: [],
  summary: {},
};

function formatDateLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toLocaleString("pt-BR");
  return value;
}

function parseNumberInput(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildWeeklySummary(history: FiiHistoryPoint[]): string {
  if (history.length < 2) {
    return "Sem dados suficientes para resumir a última semana.";
  }

  const ordered = [...history].slice(0, 5).sort((a, b) => a.date - b.date);
  if (ordered.length < 2) {
    return "Sem dados suficientes para resumir a última semana.";
  }

  const first = ordered[0].close;
  const last = ordered[ordered.length - 1].close;
  const min = Math.min(...ordered.map((item) => item.close));
  const max = Math.max(...ordered.map((item) => item.close));
  const variation = ((last - first) / first) * 100;
  const absVariation = Math.abs(variation);

  let movement = "ficou estável";
  if (absVariation >= 0.3) {
    movement = variation > 0 ? "subiu" : "caiu";
  }

  return `Nos últimos ${ordered.length} pregões, o preço ${movement} ${formatDecimalBR(
    absVariation,
    2
  )}% (min ${formatCurrencyBRL(min)} | max ${formatCurrencyBRL(max)}).`;
}

export default function FiiDetailScreen({ route }: Props) {
  const { fii, updatedAt, fundamentalsUpdatedAt } = route.params;
  const { detail, loading: detailLoading, error: detailError } = useFiiDetail(fii.ticker);
  const { rates, loading: ratesLoading } = useReferenceRates();

  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [monthlyContributionInput, setMonthlyContributionInput] = useState("500");
  const [monthsInput, setMonthsInput] = useState("24");
  const [reinvestDividends, setReinvestDividends] = useState(true);

  const detailData = detail ?? EMPTY_DETAIL;

  useEffect(() => {
    let active = true;
    (async () => {
      const favorite = await getIsFavorite(fii.ticker);
      if (!active) return;
      setIsFavorite(favorite);
    })();

    return () => {
      active = false;
    };
  }, [fii.ticker]);

  async function handleToggleFavorite() {
    setFavoriteLoading(true);
    const next = await toggleFavorite(fii.ticker);
    setIsFavorite(next);
    setFavoriteLoading(false);
  }

  const pvp = computePvp(fii);
  const status = getValuationStatus(pvp);
  const valuationMessage = getValuationMessage(
    status,
    fii.dividendYield12m,
    fii.dyStatus ?? "APURACAO"
  );
  const valuationBreakdown = getValuationBreakdown(pvp);

  const hasPrice = Number.isFinite(fii.price) && fii.price > 0;
  const hasPvp = Number.isFinite(pvp);
  const hasVp = typeof fii.vp === "number" && Number.isFinite(fii.vp) && fii.vp > 0;
  const hasPl = typeof fii.pl === "number" && Number.isFinite(fii.pl) && fii.pl > 0;
  const hasDy = Number.isFinite(fii.dividendYield12m) && fii.dividendYield12m > 0;

  const dyLabel =
    fii.dyStatus === "APURACAO" || !hasDy
      ? "em apuração"
      : `${formatDecimalBR(fii.dividendYield12m, 1)}%`;

  const fiiSimulationUnavailableReason = !hasDy
    ? "o DY estiver em apuração"
    : !hasPrice
      ? "a cotação estiver indisponível"
      : "faltarem dados para simular";

  const priceUpdatedLabel = formatDateLabel(updatedAt);
  const fundamentalsUpdatedLabel = formatDateLabel(fundamentalsUpdatedAt);

  const weeklySummary = useMemo(() => {
    if (!detailData.history.length) return null;
    return buildWeeklySummary(detailData.history);
  }, [detailData.history]);

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

    const fiiProjection = hasDy
      ? simulateFiiRecurringContribution({
          monthlyContribution,
          months,
          price: fii.price,
          dyAnnual: fii.dividendYield12m,
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
      fiiProjection,
      savingsProjection,
      fixedIncomeProjection,
    };
  }, [
    monthlyContributionInput,
    monthsInput,
    hasDy,
    fii.price,
    fii.dividendYield12m,
    reinvestDividends,
    rates,
  ]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.ticker}>{fii.ticker}</Text>
        <Pressable onPress={handleToggleFavorite} disabled={favoriteLoading} style={styles.starBtn}>
          <Text style={[styles.star, isFavorite && styles.starActive]}>
            {favoriteLoading ? "..." : isFavorite ? "★" : "☆"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.price}>
        {hasPrice ? formatCurrencyBRL(fii.price) : "Preço indisponível"}
      </Text>

      {priceUpdatedLabel || fundamentalsUpdatedLabel ? (
        <View style={styles.metaBox}>
          {priceUpdatedLabel ? (
            <Text style={styles.metaLine}>Preço atualizado em: {priceUpdatedLabel}</Text>
          ) : null}
          {fundamentalsUpdatedLabel ? (
            <Text style={styles.metaLine}>Fundamentos atualizados em: {fundamentalsUpdatedLabel}</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.status}>{status}</Text>
      <Text style={styles.message}>{valuationMessage}</Text>

      <View style={styles.block}>
        <Text style={styles.kpi}>Tipo: {fii.type}</Text>
        <Text style={styles.kpi}>P/VP: {hasPvp ? formatDecimalBR(pvp, 2) : "indisponível"}</Text>
        {hasVp ? (
          <Text style={styles.kpi}>VP (cota): {formatCurrencyBRL(fii.vp as number)}</Text>
        ) : (
          <Text style={styles.kpiMuted}>VP (cota): indisponível</Text>
        )}
        <Text style={styles.kpi}>DY (12m): {dyLabel}</Text>
        {hasPl ? (
          <Text style={styles.kpi}>PL: {formatCurrencyBRL(fii.pl as number)}</Text>
        ) : (
          <Text style={styles.kpiMuted}>PL: indisponível</Text>
        )}
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionTitle}>Critério de avaliação</Text>
        <Text style={styles.paragraph}>
          Regra fixa: P/VP abaixo de 0,95 = atrativo; entre 0,95 e 1,10 = justo; acima de 1,10 =
          esticado.
        </Text>
        {valuationBreakdown ? (
          <>
            <Text style={styles.kpi}>Faixa aplicada: {valuationBreakdown.rangeLabel}</Text>
            <Text style={styles.kpi}>
              Distância para P/VP 1,00:{" "}
              {formatDecimalBR(valuationBreakdown.distanceToReference * 100, 2)}%
              {valuationBreakdown.direction === "EM_LINHA"
                ? " (em linha)"
                : valuationBreakdown.direction === "ABAIXO"
                  ? " abaixo"
                  : " acima"}
            </Text>
          </>
        ) : (
          <Text style={styles.kpiMuted}>
            Sem P/VP válido para classificar com confiança neste momento.
          </Text>
        )}
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionTitle}>Como interpretar</Text>
        <Text style={styles.paragraph}>
          P/VP: compara preço com valor patrimonial da cota. Perto de 1 costuma indicar
          equilíbrio.
        </Text>
        <Text style={styles.paragraph}>
          DY: mostra o quanto o fundo pagou de dividendos nos últimos 12 meses.
        </Text>
        <Text style={styles.paragraph}>
          PL: patrimônio líquido do fundo. Ajuda a entender o porte do ativo.
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionTitle}>Resumo do fundo</Text>

        {detailLoading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator />
            <Text style={styles.helper}>Carregando resumo...</Text>
          </View>
        ) : null}

        {!detailLoading && detailError ? (
          <Text style={styles.kpiMuted}>{normalizeUtf8Text(detailError)}</Text>
        ) : null}

        {!detailLoading && !detailError ? (
          <>
            {detailData.name ? <Text style={styles.kpi}>{normalizeUtf8Text(detailData.name)}</Text> : null}
            {detailData.summary?.description ? (
              <Text style={styles.paragraph}>
                {normalizeUtf8Text(detailData.summary.description)}
              </Text>
            ) : (
              <Text style={styles.kpiMuted}>Resumo indisponível.</Text>
            )}
            {detailData.summary?.sector ? (
              <Text style={styles.kpi}>Setor: {normalizeUtf8Text(detailData.summary.sector)}</Text>
            ) : null}
            {detailData.summary?.industry ? (
              <Text style={styles.kpi}>
                Segmento: {normalizeUtf8Text(detailData.summary.industry)}
              </Text>
            ) : null}
            {detailData.summary?.website ? (
              <Text style={styles.kpi}>Site: {normalizeUtf8Text(detailData.summary.website)}</Text>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionTitle}>Histórico (3 meses)</Text>

        {detailLoading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator />
            <Text style={styles.helper}>Carregando histórico...</Text>
          </View>
        ) : null}

        {!detailLoading && detailError ? (
          <Text style={styles.kpiMuted}>Histórico indisponível.</Text>
        ) : null}

        {!detailLoading && !detailError && detailData.history.length ? (
          <HistorySparkline data={detailData.history} />
        ) : null}

        {!detailLoading && !detailError && weeklySummary ? (
          <Text style={styles.weeklySummary}>{weeklySummary}</Text>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionTitle}>Simulador e comparativo</Text>
        <Text style={styles.simHint}>
          Informe apenas seu aporte mensal e o tempo. O DY deste fundo é usado
          automaticamente.
        </Text>

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
            Taxas de referência: Poupança {formatDecimalBR(rates.savingsAnnual, 2)}%
            {" "}a.a. |
            {` ${normalizeUtf8Text(rates.fixedIncomeLabel)} ${formatDecimalBR(
              rates.fixedIncomeAnnual,
              2
            )}% a.a.`}
          </Text>
        ) : null}

        {rates && rates.source === "BCB" ? (
          <Text style={styles.rateInfo}>
            Fonte BCB: poupança {rates.savingsDate ?? "-"} | CDI{" "}
            {rates.fixedIncomeDate ?? "-"}
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

            {simulation.fiiProjection ? (
              <View style={styles.resultBox}>
                <Text style={styles.resultTitle}>FII {fii.ticker}</Text>
                <Text style={styles.resultLine}>
                  Valor final estimado: {formatCurrencyBRL(simulation.fiiProjection.finalValue)}
                </Text>
                <Text style={styles.resultLine}>
                  Rendimento estimado: {formatCurrencyBRL(simulation.fiiProjection.totalGain)}
                </Text>
                <Text style={styles.resultLine}>
                  Renda mensal estimada ao final:{" "}
                  {formatCurrencyBRL(simulation.fiiProjection.monthlyIncome)}
                </Text>
              </View>
            ) : (
              <View style={styles.resultBox}>
                <Text style={styles.resultTitle}>FII {fii.ticker}</Text>
                <Text style={styles.resultLine}>
                  Simulação indisponível enquanto {fiiSimulationUnavailableReason}.
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
                  Valor final estimado:{" "}
                  {formatCurrencyBRL(simulation.fixedIncomeProjection.finalValue)}
                </Text>
                <Text style={styles.resultLine}>
                  Rendimento estimado:{" "}
                  {formatCurrencyBRL(simulation.fixedIncomeProjection.totalGain)}
                </Text>
                <Text style={styles.resultLine}>
                  Renda mensal estimada ao final:{" "}
                  {formatCurrencyBRL(simulation.fixedIncomeProjection.monthlyIncomeAtEnd)}
                </Text>
              </View>
            ) : null}

            <Text style={styles.simDisclaimer}>
              Comparativo educativo. Não considera impostos, taxas, vacância ou
              variação real do mercado.
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.disclaimer}>
        Conteúdo educacional. Não é recomendação de investimento.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: "#fff" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ticker: { fontSize: 26, fontWeight: "800" },
  starBtn: { padding: 6, marginRight: -4 },
  star: { fontSize: 22, color: "#999" },
  starActive: { color: "#f2b400" },
  price: { fontSize: 18, marginTop: 6 },
  metaBox: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#fafafa",
    gap: 4,
  },
  metaLine: { fontSize: 12, color: "#555" },
  status: { fontSize: 16, fontWeight: "700", marginTop: 14 },
  message: { fontSize: 14, marginTop: 6, marginBottom: 12 },
  block: { gap: 8, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  kpi: { fontSize: 14, color: "#111" },
  kpiMuted: { fontSize: 14, color: "#777" },
  paragraph: { fontSize: 13, color: "#333", lineHeight: 18 },
  helper: { fontSize: 12, color: "#666" },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  weeklySummary: { fontSize: 12, color: "#444", marginTop: 6 },
  simHint: { fontSize: 12, color: "#555" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  switchLabel: { fontSize: 13, color: "#333", flex: 1, paddingRight: 8 },
  rateInfo: { fontSize: 12, color: "#555" },
  resultGroup: { gap: 10 },
  simSummary: { fontSize: 13, color: "#333", fontWeight: "700" },
  resultBox: {
    borderWidth: 1,
    borderColor: "#d9e8ff",
    backgroundColor: "#f3f8ff",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  resultBoxAlt: {
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#fafafa",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  resultTitle: { fontSize: 13, fontWeight: "700", color: "#111" },
  resultLine: { fontSize: 13, color: "#111" },
  simDisclaimer: { fontSize: 12, color: "#666" },
  disclaimer: { marginTop: 24, fontSize: 12, color: "#666" },
});
