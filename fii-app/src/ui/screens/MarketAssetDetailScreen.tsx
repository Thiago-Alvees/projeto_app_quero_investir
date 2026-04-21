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
import * as WebBrowser from "expo-web-browser";
import { isFavorite as getIsFavorite, toggleFavorite } from "../../data/services/favoritesService";
import { analyzeMarketAsset } from "../../domain/rules/marketValuation";
import { buildMarketAssetScore } from "../../domain/rules/investmentInsights";
import { formatCurrencyBRL, formatDecimalBR } from "../utils/format";
import { useFiiDetail } from "../hooks/useFiiDetail";
import { useEventsFeed } from "../hooks/useEventsFeed";
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

export default function MarketAssetDetailScreen({ route, navigation }: Props) {
  const { asset } = route.params;
  const analysis = useMemo(() => analyzeMarketAsset(asset), [asset]);
  const assetScore = useMemo(
    () => buildMarketAssetScore({ asset, analysis }),
    [asset, analysis]
  );
  const { detail, loading, error } = useFiiDetail(asset.ticker);
  const { items: eventsItems } = useEventsFeed();

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

  const assetEvents = useMemo(() => {
    const target = asset.ticker.toUpperCase();
    return eventsItems.filter((item) => item.ticker.toUpperCase() === target).slice(0, 6);
  }, [eventsItems, asset.ticker]);

  async function handleOpenEvent(url: string) {
    const safe = String(url ?? "").trim();
    if (!safe) return;
    await WebBrowser.openBrowserAsync(safe);
  }

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

        <View style={styles.block}>
          <View style={styles.eventsTitleRow}>
            <Text style={styles.sectionTitle}>Eventos oficiais (CVM)</Text>
            <Pressable
              onPress={() => navigation.navigate("EventsFeed", { query: asset.ticker })}
              style={styles.eventsLinkBtn}
            >
              <Text style={styles.eventsLinkText}>Ver todos</Text>
            </Pressable>
          </View>
          {assetEvents.length === 0 ? (
            <Text style={styles.kpiMuted}>Sem eventos oficiais recentes para este ativo.</Text>
          ) : (
            assetEvents.map((event) => (
              <Pressable
                key={event.id}
                onPress={() => void handleOpenEvent(event.url)}
                style={styles.eventRow}
              >
                <Text style={styles.eventTitle}>
                  {event.category}
                  {event.type ? ` • ${event.type}` : ""}
                </Text>
                <Text style={styles.eventSubject} numberOfLines={2}>
                  {normalizeUtf8Text(event.subject)}
                </Text>
                <Text style={styles.eventMeta}>
                  {formatDateLabel(event.deliveredAt ?? event.referenceDate)}
                </Text>
              </Pressable>
            ))
          )}
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
  eventsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  eventsLinkBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  eventsLinkText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  eventRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  eventTitle: { fontSize: 12, fontWeight: "800", color: "#0f172a" },
  eventSubject: { fontSize: 12, color: "#334155" },
  eventMeta: { fontSize: 11, color: "#64748b" },
  disclaimer: { marginTop: 24, fontSize: 12, color: "#666" },
});
