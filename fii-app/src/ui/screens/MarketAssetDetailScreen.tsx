import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
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
import AssetDetailLayout from "../components/asset-detail/AssetDetailLayout";
import AssetSimulationComparison from "../components/asset-detail/AssetSimulationComparison";
import { assetDetailStyles as styles } from "../components/asset-detail/styles";

type Props = NativeStackScreenProps<RootStackParamList, "MarketAssetDetail">;

function formatDateLabel(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
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
  const { detail, loading: detailLoading, error: detailError } = useFiiDetail(asset.ticker);
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

  const hasPrice = Number.isFinite(asset.price) && asset.price > 0;

  const priceUpdatedLabel = formatDateLabel(asset.priceUpdatedAt);
  const metaLines: string[] = [];
  if (priceUpdatedLabel) metaLines.push(`Preço atualizado em: ${priceUpdatedLabel}`);

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
    <AssetDetailLayout
      ticker={asset.ticker}
      isFavorite={isFavorite}
      favoriteLoading={favoriteLoading}
      onToggleFavorite={handleToggleFavorite}
      priceLabel={hasPrice ? formatCurrencyBRL(asset.price) : "Preço indisponível"}
      metaLines={metaLines}
      statusLabel={analysis.status}
      message={analysis.summary}
      scoreCard={assetScore}
    >
      <View style={styles.block}>
        <Text style={styles.kpi}>
          Tipo: {asset.assetClass === "STOCK" ? "Ação" : "ETF"} | {asset.category}
        </Text>
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
          <Text style={styles.sectionTitle}>Como interpretar</Text>
          {asset.assetClass === "STOCK" ? (
            <>
              <Text style={styles.paragraph}>
                P/VP: compara preço com valor patrimonial por ação. Perto de 1 costuma indicar
                equilíbrio.
              </Text>
              <Text style={styles.paragraph}>
                P/L: mostra quantas vezes o mercado está pagando o lucro. Números menores tendem a
                ser mais baratos, mas variam por setor.
              </Text>
              <Text style={styles.paragraph}>
                DY (12m): dividendos pagos nos últimos 12 meses em relação ao preço atual.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.paragraph}>
                Taxa do ETF: custo anual do fundo. Quanto menor, melhor (tudo igual).
              </Text>
              <Text style={styles.paragraph}>
                Retorno esperado: usado apenas como régua didática para simulações. Não é garantia
                de resultado.
              </Text>
              <Text style={styles.paragraph}>
                DY (12m): quando disponível, mostra distribuições dos últimos 12 meses.
              </Text>
            </>
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Resumo do ativo</Text>
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
              {detail?.name ? <Text style={styles.kpi}>{normalizeUtf8Text(detail.name)}</Text> : null}
              {detail?.summary?.description ? (
                <Text style={styles.paragraph}>
                  {normalizeUtf8Text(detail.summary.description)}
                </Text>
              ) : (
                <Text style={styles.kpiMuted}>Resumo indisponível no momento.</Text>
              )}

              {detail?.summary?.sector ? (
                <Text style={styles.kpi}>Setor: {normalizeUtf8Text(detail.summary.sector)}</Text>
              ) : null}
              {detail?.summary?.industry ? (
                <Text style={styles.kpi}>
                  Segmento: {normalizeUtf8Text(detail.summary.industry)}
                </Text>
              ) : null}
              {detail?.summary?.website ? (
                <Text style={styles.kpi}>Site: {normalizeUtf8Text(detail.summary.website)}</Text>
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

          {!detailLoading && !detailError && detail?.history?.length ? (
            <HistorySparkline data={detail.history} />
          ) : null}

          {!detailLoading && !detailError && weeklySummary ? (
            <Text style={styles.weeklySummary}>{weeklySummary}</Text>
          ) : null}
        </View>

        <AssetSimulationComparison
          assetLabel={`${asset.assetClass === "STOCK" ? "Ação" : "ETF"} ${asset.ticker}`}
          hint="Informe apenas seu aporte mensal e o tempo. O DY deste ativo é usado automaticamente."
          price={asset.price}
          dividendYield12m={asset.dividendYield12m}
        />

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
    </AssetDetailLayout>
  );
}
