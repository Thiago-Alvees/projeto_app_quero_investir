import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getFavorites } from "../../data/services/favoritesService";
import { listPortfolios } from "../../data/services/portfolioService";
import {
  buildDividendCalendarEvents,
  type DividendCalendarEvent,
} from "../../domain/rules/dividendCalendar";
import {
  clearDividendNotifications,
  scheduleDividendNotifications,
} from "../../data/services/notificationService";
import { useFiiList } from "../hooks/useFiiList";
import { useInvestmentCatalog } from "../hooks/useInvestmentCatalog";
import { useMarketAssets } from "../hooks/useMarketAssets";
import { formatCurrencyBRL, formatDecimalBR } from "../utils/format";

type ScopeFilter = "ALL" | "FAVORITES" | "PORTFOLIO";
type AssetFilter = "ALL" | "FII" | "STOCK" | "ETF";

const SCOPE_OPTIONS: Array<{ id: ScopeFilter; label: string }> = [
  { id: "ALL", label: "Todos" },
  { id: "FAVORITES", label: "Favoritos" },
  { id: "PORTFOLIO", label: "Carteira" },
];

const ASSET_OPTIONS: Array<{ id: AssetFilter; label: string }> = [
  { id: "ALL", label: "Todos" },
  { id: "FII", label: "FIIs" },
  { id: "STOCK", label: "Ações" },
  { id: "ETF", label: "ETFs" },
];

function toAssetKey(assetClass: string, ticker: string): string {
  return `${assetClass}:${ticker}`;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("pt-BR");
}

function assetClassLabel(value: "FII" | "STOCK" | "ETF"): string {
  if (value === "STOCK") return "Ação";
  if (value === "ETF") return "ETF";
  return "FII";
}

export default function DividendCalendarScreen() {
  const navigation = useNavigation<any>();
  const { items: catalogItems, loading: catalogLoading } = useInvestmentCatalog();
  const { fiis, updatedAt: fiiUpdatedAt, fundamentalsUpdatedAt } = useFiiList();
  const { assets: marketAssets } = useMarketAssets();

  const [scope, setScope] = useState<ScopeFilter>("ALL");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("ALL");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [portfolioAssetKeys, setPortfolioAssetKeys] = useState<Set<string>>(new Set());
  const [selectionLoading, setSelectionLoading] = useState(true);
  const [notificationFeedback, setNotificationFeedback] = useState<string | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const loadSelections = useCallback(() => {
    let active = true;
    (async () => {
      setSelectionLoading(true);
      const [favoriteList, portfolios] = await Promise.all([
        getFavorites(),
        listPortfolios(),
      ]);
      if (!active) return;

      const nextFavorites = new Set(favoriteList.map((item) => item.toUpperCase()));
      const nextPortfolioKeys = new Set<string>();
      for (const portfolio of portfolios) {
        for (const asset of portfolio.assets) {
          nextPortfolioKeys.add(toAssetKey(asset.assetClass, asset.ticker));
        }
      }

      setFavorites(nextFavorites);
      setPortfolioAssetKeys(nextPortfolioKeys);
      setSelectionLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(loadSelections);

  const fiiByTicker = useMemo(() => {
    const map = new Map<string, (typeof fiis)[number]>();
    for (const item of fiis) {
      map.set(item.ticker, item);
    }
    return map;
  }, [fiis]);

  const marketByTicker = useMemo(() => {
    const map = new Map<string, (typeof marketAssets)[number]>();
    for (const item of marketAssets) {
      map.set(item.ticker, item);
    }
    return map;
  }, [marketAssets]);

  const filteredItems = useMemo(() => {
    let base = catalogItems.filter(
      (item) =>
        Number.isFinite(item.price) &&
        item.price > 0 &&
        Number.isFinite(item.dividendYield12m) &&
        item.dividendYield12m > 0
    );

    if (scope === "FAVORITES") {
      base = base.filter((item) => favorites.has(item.ticker.toUpperCase()));
    } else if (scope === "PORTFOLIO") {
      base = base.filter((item) =>
        portfolioAssetKeys.has(toAssetKey(item.assetClass, item.ticker))
      );
    }

    if (assetFilter !== "ALL") {
      base = base.filter((item) => item.assetClass === assetFilter);
    }

    return base;
  }, [catalogItems, scope, favorites, portfolioAssetKeys, assetFilter]);

  const events = useMemo(
    () => buildDividendCalendarEvents(filteredItems, { monthsAhead: 3 }),
    [filteredItems]
  );

  const totalEstimatedMonthly = useMemo(
    () =>
      filteredItems.reduce(
        (sum, item) => sum + (item.price * item.dividendYield12m) / 100 / 12,
        0
      ),
    [filteredItems]
  );

  const nextEvent = events[0] ?? null;
  const loading = catalogLoading || selectionLoading;

  async function handleEnableNotifications() {
    setNotificationLoading(true);
    const result = await scheduleDividendNotifications(events);
    setNotificationFeedback(result.message);
    setNotificationLoading(false);
  }

  async function handleDisableNotifications() {
    setNotificationLoading(true);
    await clearDividendNotifications();
    setNotificationFeedback("Lembretes da agenda removidos com sucesso.");
    setNotificationLoading(false);
  }

  function handleOpenAsset(event: DividendCalendarEvent) {
    if (event.assetClass === "FII") {
      const fii = fiiByTicker.get(event.ticker);
      if (!fii) return;
      navigation.navigate("FiiDetail", {
        fii,
        updatedAt: fiiUpdatedAt,
        fundamentalsUpdatedAt,
      });
      return;
    }

    const market = marketByTicker.get(event.ticker);
    if (!market) return;
    navigation.navigate("MarketAssetDetail", { asset: market });
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.title}>Agenda de Dividendos</Text>
          <Text style={styles.subtitle}>
            Próximos 3 meses com estimativa por cota para facilitar sua análise.
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Eventos</Text>
            <Text style={styles.summaryValue}>{events.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Ativos</Text>
            <Text style={styles.summaryValue}>{filteredItems.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Renda mensal*</Text>
            <Text style={styles.summaryValue}>{formatCurrencyBRL(totalEstimatedMonthly)}</Text>
          </View>
        </View>

        {nextEvent ? (
          <View style={styles.nextCard}>
            <Text style={styles.nextTitle}>Próximo evento</Text>
            <Text style={styles.nextLine}>
              {nextEvent.ticker} ({assetClassLabel(nextEvent.assetClass)}) •{" "}
              {formatDateLabel(nextEvent.paymentDateIso)}
            </Text>
            <Text style={styles.nextLine}>
              Estimativa por evento: {formatCurrencyBRL(nextEvent.estimatedPerEvent)}
            </Text>
          </View>
        ) : null}

        <View style={styles.notificationRow}>
          <Pressable
            onPress={handleEnableNotifications}
            style={[styles.notificationBtn, styles.notificationPrimary]}
            disabled={notificationLoading}
          >
            <Text style={styles.notificationPrimaryText}>
              {notificationLoading ? "Processando..." : "Ativar lembretes"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleDisableNotifications}
            style={[styles.notificationBtn, styles.notificationSecondary]}
            disabled={notificationLoading}
          >
            <Text style={styles.notificationSecondaryText}>Desativar</Text>
          </Pressable>
        </View>
        {notificationFeedback ? (
          <Text style={styles.notificationHint}>{notificationFeedback}</Text>
        ) : null}

        <Text style={styles.filterLabel}>Escopo</Text>
        <View style={styles.chipRow}>
          {SCOPE_OPTIONS.map((option) => {
            const active = scope === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setScope(option.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.filterLabel}>Classe de ativo</Text>
        <View style={styles.chipRow}>
          {ASSET_OPTIONS.map((option) => {
            const active = assetFilter === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setAssetFilter(option.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.helper}>Montando agenda...</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.helper}>
              Nenhum evento encontrado para esse filtro. Tente mudar escopo/classe.
            </Text>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable style={styles.eventCard} onPress={() => handleOpenAsset(item)}>
                <View style={styles.eventTopRow}>
                  <Text style={styles.eventTicker}>
                    {item.ticker} • {assetClassLabel(item.assetClass)}
                  </Text>
                  <Text style={styles.eventDate}>{formatDateLabel(item.paymentDateIso)}</Text>
                </View>
                <Text style={styles.eventName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.eventLine}>
                  Estimativa por evento: {formatCurrencyBRL(item.estimatedPerEvent)}
                </Text>
                <Text style={styles.eventLine}>
                  Renda mensal estimada (por cota): {formatCurrencyBRL(item.estimatedMonthly)}
                </Text>
                <Text style={styles.eventMeta}>
                  DY (12m): {formatDecimalBR(item.dy12m, 1)}% • {item.category}
                </Text>
              </Pressable>
            )}
          />
        )}

        <Text style={styles.disclaimer}>
          * Estimativa educativa com 1 cota por ativo. Não considera impostos ou variação real de
          proventos.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#edf2f7" },
  container: { flex: 1, padding: 16 },
  hero: {
    borderRadius: 16,
    backgroundColor: "#0f172a",
    padding: 14,
    gap: 6,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 12, color: "#bfdbfe" },
  summaryRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  summaryCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    backgroundColor: "#fff",
    padding: 10,
  },
  summaryLabel: { fontSize: 11, color: "#64748b" },
  summaryValue: { fontSize: 13, color: "#111827", fontWeight: "800", marginTop: 3 },
  nextCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1fae5",
    backgroundColor: "#ecfdf5",
    padding: 10,
    gap: 3,
  },
  nextTitle: { fontSize: 12, fontWeight: "800", color: "#065f46" },
  nextLine: { fontSize: 12, color: "#065f46" },
  notificationRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  notificationBtn: {
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  notificationPrimary: {
    flex: 1,
    backgroundColor: "#111827",
  },
  notificationPrimaryText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  notificationSecondary: {
    borderWidth: 1,
    borderColor: "#111827",
    paddingHorizontal: 12,
  },
  notificationSecondaryText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  notificationHint: { marginTop: 6, fontSize: 11, color: "#475569" },
  filterLabel: { marginTop: 10, fontSize: 12, color: "#475569" },
  chipRow: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  chipText: { fontSize: 12, color: "#334155", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  list: { marginTop: 12, paddingBottom: 10 },
  eventCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 10,
    gap: 3,
  },
  eventTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  eventTicker: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  eventDate: { fontSize: 12, color: "#334155" },
  eventName: { fontSize: 12, color: "#334155" },
  eventLine: { fontSize: 12, color: "#111827" },
  eventMeta: { fontSize: 11, color: "#64748b" },
  center: { marginTop: 24, alignItems: "center", gap: 8 },
  helper: { fontSize: 12, color: "#64748b", textAlign: "center" },
  disclaimer: { marginTop: 4, fontSize: 11, color: "#64748b" },
});
