import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/AppNavigator";
import type { FiiDetail, FiiHistoryPoint } from "../../data/services/fiiService";
import HistorySparkline from "../components/HistorySparkline";
import { isFavorite as getIsFavorite, toggleFavorite } from "../../data/services/favoritesService";
import {
  getFiiAlertRule,
  removeFiiAlertRule,
  upsertFiiAlertRule,
} from "../../data/services/alertService";
import { computePvp } from "../../domain/rules/pvp";
import {
  getValuationBreakdown,
  getValuationMessage,
  getValuationStatus,
} from "../../domain/rules/valuation";
import { buildFiiScore } from "../../domain/rules/investmentInsights";
import { useFiiDetail } from "../hooks/useFiiDetail";
import { formatCurrencyBRL, formatDecimalBR } from "../utils/format";
import { normalizeUtf8Text } from "../utils/text";
import AssetDetailLayout from "../components/asset-detail/AssetDetailLayout";
import AssetSimulationComparison from "../components/asset-detail/AssetSimulationComparison";
import { assetDetailStyles as styles } from "../components/asset-detail/styles";

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
  )}% (mín ${formatCurrencyBRL(min)} | máx ${formatCurrencyBRL(max)}).`;
}

export default function FiiDetailScreen({ route }: Props) {
  const { fii, updatedAt, fundamentalsUpdatedAt } = route.params;
  const { detail, loading: detailLoading, error: detailError } = useFiiDetail(fii.ticker);

  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [alertPriceInput, setAlertPriceInput] = useState("");
  const [alertDyInput, setAlertDyInput] = useState("");
  const [alertLoading, setAlertLoading] = useState(false);

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

  useEffect(() => {
    let active = true;
    (async () => {
      const rule = await getFiiAlertRule(fii.ticker);
      if (!active || !rule) return;
      setAlertPriceInput(rule.maxPrice ? String(rule.maxPrice) : "");
      setAlertDyInput(rule.minDy ? String(rule.minDy) : "");
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

  async function handleSaveAlert() {
    setAlertLoading(true);
    const saved = await upsertFiiAlertRule({
      ticker: fii.ticker,
      maxPrice: parseNumberInput(alertPriceInput),
      minDy: parseNumberInput(alertDyInput),
    });
    setAlertLoading(false);

    if (!saved) {
      Alert.alert(
        "Alerta inválido",
        "Preencha ao menos um critério (preço máximo ou DY mínimo)."
      );
      return;
    }

    Alert.alert("Alerta salvo", `Alerta de ${fii.ticker} atualizado com sucesso.`);
  }

  async function handleClearAlert() {
    setAlertLoading(true);
    await removeFiiAlertRule(fii.ticker);
    setAlertPriceInput("");
    setAlertDyInput("");
    setAlertLoading(false);
  }

  const pvp = computePvp(fii);
  const status = getValuationStatus(pvp);
  const valuationMessage = getValuationMessage(
    status,
    fii.dividendYield12m,
    fii.dyStatus ?? "APURACAO"
  );
  const valuationBreakdown = getValuationBreakdown(pvp);
  const fiiScore = useMemo(() => buildFiiScore({ fii, pvp, status }), [fii, pvp, status]);

  const hasPrice = Number.isFinite(fii.price) && fii.price > 0;
  const hasPvp = Number.isFinite(pvp);
  const hasVp = typeof fii.vp === "number" && Number.isFinite(fii.vp) && fii.vp > 0;
  const hasPl = typeof fii.pl === "number" && Number.isFinite(fii.pl) && fii.pl > 0;
  const hasDy = Number.isFinite(fii.dividendYield12m) && fii.dividendYield12m > 0;

  const dyLabel =
    fii.dyStatus === "APURACAO" || !hasDy
      ? "em apuração"
      : `${formatDecimalBR(fii.dividendYield12m, 1)}%`;

  const priceUpdatedLabel = formatDateLabel(updatedAt);
  const fundamentalsUpdatedLabel = formatDateLabel(fundamentalsUpdatedAt);

  const weeklySummary = useMemo(() => {
    if (!detailData.history.length) return null;
    return buildWeeklySummary(detailData.history);
  }, [detailData.history]);

  const metaLines: string[] = [];
  if (priceUpdatedLabel) metaLines.push(`Preço atualizado em: ${priceUpdatedLabel}`);
  if (fundamentalsUpdatedLabel) {
    metaLines.push(`Fundamentos atualizados em: ${fundamentalsUpdatedLabel}`);
  }

  return (
    <AssetDetailLayout
      ticker={fii.ticker}
      isFavorite={isFavorite}
      favoriteLoading={favoriteLoading}
      onToggleFavorite={handleToggleFavorite}
      priceLabel={hasPrice ? formatCurrencyBRL(fii.price) : "Preço indisponível"}
      metaLines={metaLines}
      statusLabel={status}
      message={valuationMessage}
      scoreCard={fiiScore}
    >
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
        <Text style={styles.sectionTitle}>Alertas do ativo</Text>
        <Text style={styles.simHint}>
          Configure alerta para acompanhar preço alvo e DY mínimo deste FII.
        </Text>
        <TextInput
          value={alertPriceInput}
          onChangeText={setAlertPriceInput}
          keyboardType="numeric"
          placeholder="Preço máximo (ex: 115,50)"
          style={styles.input}
        />
        <TextInput
          value={alertDyInput}
          onChangeText={setAlertDyInput}
          keyboardType="numeric"
          placeholder="DY mínimo (ex: 9,0)"
          style={styles.input}
        />
        <View style={styles.alertActions}>
          <Pressable onPress={handleSaveAlert} style={styles.alertPrimary} disabled={alertLoading}>
            <Text style={styles.alertPrimaryText}>
              {alertLoading ? "Salvando..." : "Salvar alerta"}
            </Text>
          </Pressable>
          <Pressable onPress={handleClearAlert} style={styles.alertSecondary} disabled={alertLoading}>
            <Text style={styles.alertSecondaryText}>Remover</Text>
          </Pressable>
        </View>
      </View>

      <AssetSimulationComparison
        assetLabel={`FII ${fii.ticker}`}
        hint="Informe apenas seu aporte mensal e o tempo. O DY deste fundo é usado automaticamente."
        price={fii.price}
        dividendYield12m={fii.dividendYield12m}
        dyStatus={fii.dyStatus ?? "APURACAO"}
      />

      <Text style={styles.disclaimer}>
        Conteúdo educacional. Não é recomendação de investimento.
      </Text>
    </AssetDetailLayout>
  );
}
