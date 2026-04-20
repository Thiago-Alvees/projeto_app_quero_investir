import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/AppNavigator";
import HistorySparkline from "../components/HistorySparkline";
import { isFavorite as getIsFavorite, toggleFavorite } from "../../data/services/favoritesService";
import { analyzeMarketAsset } from "../../domain/rules/marketValuation";
import { buildMarketAssetScore } from "../../domain/rules/investmentInsights";
import { formatCurrencyBRL, formatDecimalBR } from "../utils/format";
import { useFiiDetail } from "../hooks/useFiiDetail";
import type { FiiHistoryPoint } from "../../data/services/fiiService";
import { normalizeUtf8Text } from "../utils/text";

type Props = NativeStackScreenProps<RootStackParamList, "MarketAssetDetail">;

function formatDateLabel(value?: string | null): string {
  if (!value) return "indisponível";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "indisponível";
  return date.toLocaleString("pt-BR");
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

export default function MarketAssetDetailScreen({ route }: Props) {
  const { asset } = route.params;
  const analysis = useMemo(() => analyzeMarketAsset(asset), [asset]);
  const assetScore = useMemo(
    () => buildMarketAssetScore({ asset, analysis }),
    [asset, analysis]
  );
  const { detail, loading, error } = useFiiDetail(asset.ticker);

  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const favorite = await getIsFavorite(asset.ticker);
      if (!active) return;
      setIsFavorite(favorite);
    })();
    return () => {
      active = false;
    };
  }, [asset.ticker]);

  async function handleToggleFavorite() {
    setFavoriteLoading(true);
    const next = await toggleFavorite(asset.ticker);
    setIsFavorite(next);
    setFavoriteLoading(false);
  }

  const weeklySummary = useMemo(() => {
    if (!detail?.history?.length) return null;
    return buildWeeklySummary(detail.history);
  }, [detail?.history]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.ticker}>{asset.ticker}</Text>
            <Text style={styles.assetName}>{asset.name}</Text>
          </View>
          <Pressable onPress={handleToggleFavorite} disabled={favoriteLoading} style={styles.starBtn}>
            <Text style={[styles.star, isFavorite && styles.starActive]}>
              {favoriteLoading ? "..." : isFavorite ? "★" : "☆"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.price}>{formatCurrencyBRL(asset.price)}</Text>
        <Text style={styles.typeLabel}>
          Tipo: {asset.assetClass === "STOCK" ? "Ação" : "ETF"} | {asset.category}
        </Text>
        <Text style={styles.metaLine}>Preço atualizado em: {formatDateLabel(asset.priceUpdatedAt)}</Text>

        <Text style={styles.status}>{analysis.status}</Text>
        <Text style={styles.message}>{analysis.summary}</Text>

        <View style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>Score didático: {assetScore.score}/100</Text>
          <Text style={styles.scoreLabel}>{assetScore.label}</Text>
          {assetScore.reasons.map((reason) => (
            <Text key={reason} style={styles.scoreReason}>
              • {reason}
            </Text>
          ))}
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Indicadores principais</Text>
          <Text style={styles.kpi}>
            P/VP: {typeof asset.pvp === "number" ? formatDecimalBR(asset.pvp, 2) : "indisponível"}
          </Text>
          <Text style={styles.kpi}>
            DY (12m):{" "}
            {typeof asset.dividendYield12m === "number"
              ? `${formatDecimalBR(asset.dividendYield12m, 1)}%`
              : "indisponível"}
          </Text>
          <Text style={styles.kpi}>
            P/L: {typeof asset.pl === "number" ? formatDecimalBR(asset.pl, 1) : "indisponível"}
          </Text>
          <Text style={styles.kpi}>
            Taxa ETF:{" "}
            {typeof asset.expenseRatio === "number"
              ? `${formatDecimalBR(asset.expenseRatio, 2)}%`
              : "não se aplica"}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Critério de avaliação</Text>
          <Text style={styles.paragraph}>{analysis.ruleLabel}</Text>
          <Text style={styles.paragraph}>
            Esta classificação é educativa. Ela ajuda a comparar ativos com uma régua simples.
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Resumo e histórico (3 meses)</Text>
          {loading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator />
              <Text style={styles.helper}>Carregando dados do ativo...</Text>
            </View>
          ) : null}

          {!loading && error ? <Text style={styles.kpiMuted}>{normalizeUtf8Text(error)}</Text> : null}

          {!loading && !error ? (
            <>
              {detail?.summary?.description ? (
                <Text style={styles.paragraph}>{normalizeUtf8Text(detail.summary.description)}</Text>
              ) : (
                <Text style={styles.kpiMuted}>Resumo indisponível no momento.</Text>
              )}

              {detail?.history?.length ? <HistorySparkline data={detail.history} /> : null}
              {weeklySummary ? <Text style={styles.weeklySummary}>{weeklySummary}</Text> : null}
            </>
          ) : null}
        </View>

        <Text style={styles.disclaimer}>
          Conteúdo educacional. Não é recomendação de investimento.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flexGrow: 1, padding: 16, backgroundColor: "#fff" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  headerInfo: { flex: 1 },
  ticker: { fontSize: 26, fontWeight: "800" },
  assetName: { fontSize: 13, color: "#555", marginTop: 4 },
  starBtn: { padding: 6, marginRight: -4 },
  star: { fontSize: 22, color: "#999" },
  starActive: { color: "#f2b400" },
  price: { fontSize: 18, marginTop: 8 },
  typeLabel: { fontSize: 13, color: "#666", marginTop: 4 },
  metaLine: { fontSize: 12, color: "#555", marginTop: 8 },
  status: { fontSize: 16, fontWeight: "700", marginTop: 14 },
  message: { fontSize: 14, marginTop: 6 },
  scoreCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#f0f7ff",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  scoreTitle: { fontSize: 14, fontWeight: "800", color: "#1d4ed8" },
  scoreLabel: { fontSize: 12, fontWeight: "700", color: "#1f2937" },
  scoreReason: { fontSize: 12, color: "#374151" },
  block: { gap: 8, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  kpi: { fontSize: 14, color: "#111" },
  kpiMuted: { fontSize: 14, color: "#777" },
  paragraph: { fontSize: 13, color: "#333", lineHeight: 18 },
  helper: { fontSize: 12, color: "#666" },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  weeklySummary: { fontSize: 12, color: "#444", marginTop: 6 },
  disclaimer: { marginTop: 24, fontSize: 12, color: "#666" },
});
