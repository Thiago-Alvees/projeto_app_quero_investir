import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { PortfolioAssetCatalogItem } from "../../data/mock/investmentCatalog";
import type { Fii } from "../../domain/models/fii";
import type { FiiType } from "../../domain/models/fiiType";
import type { MarketAsset } from "../../domain/models/marketAsset";
import { FII_TYPES } from "../../domain/models/fiiType";
import { computePvp } from "../../domain/rules/pvp";
import { buildFiiRadar } from "../../domain/rules/investmentInsights";
import { getFavorites } from "../../data/services/favoritesService";
import {
  evaluateFiiAlertHits,
  listFiiAlertRules,
  type FiiAlertHit,
} from "../../data/services/alertService";
import FiiCard from "../components/FiiCard";
import MarketAssetCard from "../components/MarketAssetCard";
import { useFiiList } from "../hooks/useFiiList";
import { useInvestmentCatalog } from "../hooks/useInvestmentCatalog";
import { useMarketAssets } from "../hooks/useMarketAssets";
import { formatCurrencyBRL, formatDecimalBR } from "../utils/format";
import { normalizeUtf8Text } from "../utils/text";

type SortOption = "DY_DESC" | "DY_ASC" | "PRICE_DESC" | "PRICE_ASC";
type AssetTab = "FII" | "STOCK" | "ETF";

const DEFAULT_SORT: SortOption = "DY_DESC";
const SORT_OPTIONS: Array<{ id: SortOption; label: string }> = [
  { id: "DY_DESC", label: "DY maior" },
  { id: "DY_ASC", label: "DY menor" },
  { id: "PRICE_DESC", label: "Preço maior" },
  { id: "PRICE_ASC", label: "Preço menor" },
];

function parseNumberInput(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortWithNulls(a: number | null, b: number | null, dir: "asc" | "desc"): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

function getFiiDyValue(fii: Fii): number | null {
  return Number.isFinite(fii.dividendYield12m) ? fii.dividendYield12m : null;
}

function getMarketDyValue(asset: MarketAsset): number | null {
  if (typeof asset.dividendYield12m !== "number") return null;
  return Number.isFinite(asset.dividendYield12m) ? asset.dividendYield12m : null;
}

function getSortValue(
  sortBy: SortOption,
  dyValue: number | null,
  price: number
): { left: number | null; right: "asc" | "desc" } {
  if (sortBy === "DY_ASC") return { left: dyValue, right: "asc" };
  if (sortBy === "DY_DESC") return { left: dyValue, right: "desc" };
  if (sortBy === "PRICE_ASC") return { left: Number.isFinite(price) ? price : null, right: "asc" };
  return { left: Number.isFinite(price) ? price : null, right: "desc" };
}

function assetClassLabel(value: "FII" | "STOCK" | "ETF"): string {
  if (value === "STOCK") return "Ação";
  if (value === "ETF") return "ETF";
  return "FII";
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const {
    fiis,
    loading: fiiLoading,
    error: fiiError,
    updatedAt: fiiUpdatedAt,
    fundamentalsUpdatedAt,
    refresh: refreshFiis,
  } = useFiiList();

  const {
    assets: marketAssets,
    loading: marketLoading,
    error: marketError,
    refresh: refreshMarket,
  } = useMarketAssets();
  const { items: catalogItems } = useInvestmentCatalog();

  const [assetTab, setAssetTab] = useState<AssetTab>("FII");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [minDy, setMinDy] = useState("");
  const [maxDy, setMaxDy] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [favoriteTickers, setFavoriteTickers] = useState<Set<string>>(new Set());
  const [alertHits, setAlertHits] = useState<FiiAlertHit[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareQuery, setCompareQuery] = useState("");
  const [compareKeys, setCompareKeys] = useState<string[]>([]);

  const loadFavorites = useCallback(() => {
    let active = true;

    (async () => {
      const favorites = await getFavorites();
      if (!active) return;
      setFavoriteTickers(new Set(favorites));
    })();

    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(loadFavorites);
  useEffect(() => {
    let active = true;
    (async () => {
      const rules = await listFiiAlertRules();
      if (!active) return;
      setAlertHits(evaluateFiiAlertHits(fiis, rules));
    })();
    return () => {
      active = false;
    };
  }, [fiis]);

  const dyMin = parseNumberInput(minDy);
  const dyMax = parseNumberInput(maxDy);

  const activeMarketAssets = useMemo(() => {
    if (assetTab === "STOCK") return marketAssets.filter((item) => item.assetClass === "STOCK");
    if (assetTab === "ETF") return marketAssets.filter((item) => item.assetClass === "ETF");
    return [];
  }, [assetTab, marketAssets]);

  const categoryOptions = useMemo(() => {
    if (assetTab === "FII") return FII_TYPES;
    return Array.from(new Set(activeMarketAssets.map((item) => item.category))).sort();
  }, [assetTab, activeMarketAssets]);

  const fiiByTicker = useMemo(() => {
    const map = new Map<string, Fii>();
    for (const item of fiis) {
      map.set(item.ticker, item);
    }
    return map;
  }, [fiis]);

  const marketByTicker = useMemo(() => {
    const map = new Map<string, MarketAsset>();
    for (const item of marketAssets) {
      map.set(item.ticker, item);
    }
    return map;
  }, [marketAssets]);

  const radarData = useMemo(
    () =>
      buildFiiRadar(
        fiis.map((fii) => ({
          ...fii,
          pvp: computePvp(fii),
        }))
      ),
    [fiis]
  );

  const compareCandidates = useMemo(() => {
    const query = compareQuery.toLowerCase().trim();
    return catalogItems
      .filter((item) => !compareKeys.includes(`${item.assetClass}:${item.ticker}`))
      .filter((item) =>
        query
          ? item.ticker.toLowerCase().includes(query) ||
            item.name.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
          : true
      )
      .slice(0, 8);
  }, [catalogItems, compareKeys, compareQuery]);

  const compareItems = useMemo(
    () =>
      compareKeys
        .map((key) => catalogItems.find((item) => `${item.assetClass}:${item.ticker}` === key))
        .filter((item): item is PortfolioAssetCatalogItem => Boolean(item)),
    [catalogItems, compareKeys]
  );

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    onlyFavorites ||
    minDy.trim().length > 0 ||
    maxDy.trim().length > 0 ||
    sortBy !== DEFAULT_SORT;

  function toggleCategory(value: string) {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }

  function toggleCompareKey(key: string) {
    setCompareKeys((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : prev.length >= 3
          ? prev
          : [...prev, key]
    );
  }

  function clearFilters() {
    setSelectedCategories([]);
    setOnlyFavorites(false);
    setMinDy("");
    setMaxDy("");
    setSortBy(DEFAULT_SORT);
  }

  const filteredFiis = useMemo(() => {
    if (assetTab !== "FII") return [];
    return fiis.filter((fii) => {
      const matchesType =
        selectedCategories.length === 0 || selectedCategories.includes(fii.type as FiiType);
      if (!matchesType) return false;

      const matchesFavorite = !onlyFavorites || favoriteTickers.has(fii.ticker);
      if (!matchesFavorite) return false;

      const dyValue = getFiiDyValue(fii);
      if (dyMin !== null && (dyValue === null || dyValue < dyMin)) return false;
      if (dyMax !== null && (dyValue === null || dyValue > dyMax)) return false;
      return true;
    });
  }, [assetTab, fiis, selectedCategories, onlyFavorites, favoriteTickers, dyMin, dyMax]);

  const sortedFiis = useMemo(() => {
    if (assetTab !== "FII") return [];
    const list = [...filteredFiis];
    list.sort((a, b) => {
      const leftA = getSortValue(sortBy, getFiiDyValue(a), a.price);
      const leftB = getSortValue(sortBy, getFiiDyValue(b), b.price);
      return sortWithNulls(leftA.left, leftB.left, leftA.right);
    });
    return list;
  }, [assetTab, filteredFiis, sortBy]);

  const filteredMarketAssets = useMemo(() => {
    if (assetTab === "FII") return [];
    return activeMarketAssets.filter((asset) => {
      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(asset.category);
      if (!matchesCategory) return false;

      const matchesFavorite = !onlyFavorites || favoriteTickers.has(asset.ticker);
      if (!matchesFavorite) return false;

      const dyValue = getMarketDyValue(asset);
      if (dyMin !== null && (dyValue === null || dyValue < dyMin)) return false;
      if (dyMax !== null && (dyValue === null || dyValue > dyMax)) return false;
      return true;
    });
  }, [assetTab, activeMarketAssets, selectedCategories, onlyFavorites, favoriteTickers, dyMin, dyMax]);

  const sortedMarketAssets = useMemo(() => {
    if (assetTab === "FII") return [];
    const list = [...filteredMarketAssets];
    list.sort((a, b) => {
      const leftA = getSortValue(sortBy, getMarketDyValue(a), a.price);
      const leftB = getSortValue(sortBy, getMarketDyValue(b), b.price);
      return sortWithNulls(leftA.left, leftB.left, leftA.right);
    });
    return list;
  }, [assetTab, filteredMarketAssets, sortBy]);

  async function handleRefresh() {
    await Promise.all([refreshFiis(), refreshMarket()]);
  }

  function switchTab(next: AssetTab) {
    setAssetTab(next);
    clearFilters();
    setFiltersOpen(false);
  }

  function openFiiByTicker(ticker: string) {
    const fii = fiiByTicker.get(ticker);
    if (!fii) return;
    navigation.navigate("FiiDetail", {
      fii,
      updatedAt: fiiUpdatedAt,
      fundamentalsUpdatedAt,
    });
  }

  function openCatalogAsset(item: PortfolioAssetCatalogItem) {
    if (item.assetClass === "FII") {
      openFiiByTicker(item.ticker);
      return;
    }

    const asset = marketByTicker.get(item.ticker);
    if (!asset) return;
    navigation.navigate("MarketAssetDetail", { asset });
  }

  const totalItems = assetTab === "FII" ? fiis.length : activeMarketAssets.length;
  const visibleItems = assetTab === "FII" ? sortedFiis.length : sortedMarketAssets.length;
  const loading = assetTab === "FII" ? fiiLoading : marketLoading;
  const error = assetTab === "FII" ? fiiError : marketError;

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.title}>Mercado</Text>
              <Text style={styles.subtitle}>Análises simples para FIIs, ações e ETFs</Text>
            </View>
            <Pressable style={styles.countryButton}>
              <View style={styles.countryFlagCircle}>
                <Text style={styles.countryFlag}>🇧🇷</Text>
              </View>
              <Text style={styles.countryLabel}>Brasil</Text>
            </Pressable>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatLabel}>Ativos</Text>
              <Text style={styles.heroStatValue}>{totalItems}</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatLabel}>Com filtro</Text>
              <Text style={styles.heroStatValue}>{visibleItems}</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatLabel}>Favoritos</Text>
              <Text style={styles.heroStatValue}>{favoriteTickers.size}</Text>
            </View>
          </View>
        </View>

        <View style={styles.segmentRow}>
          <View style={styles.tabRow}>
            {([
              ["FII", "FIIs"],
              ["STOCK", "Ações"],
              ["ETF", "ETFs"],
            ] as Array<[AssetTab, string]>).map(([key, label]) => {
              const active = assetTab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => switchTab(key)}
                  style={[styles.tabChip, active && styles.tabChipActive]}
                >
                  <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={handleRefresh}
            style={styles.refreshBtn}
            disabled={fiiLoading || marketLoading}
          >
            <Text style={styles.refreshText}>
              {fiiLoading || marketLoading ? "Atualizando..." : "Atualizar"}
            </Text>
          </Pressable>
        </View>

        {alertHits.length > 0 ? (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>Alertas disparados</Text>
            {alertHits.slice(0, 3).map((hit) => (
              <Pressable key={`${hit.ticker}-${hit.reason}`} onPress={() => openFiiByTicker(hit.ticker)}>
                <Text style={styles.alertLine}>
                  • {hit.ticker}: {normalizeUtf8Text(hit.reason)}
                </Text>
              </Pressable>
            ))}
            {alertHits.length > 3 ? (
              <Text style={styles.alertHint}>+{alertHits.length - 3} alerta(s) disponível(is).</Text>
            ) : null}
          </View>
        ) : null}

        {assetTab === "FII" && !loading ? (
          <View style={styles.radarCard}>
            <Text style={styles.radarTitle}>Radar rápido</Text>
            <View style={styles.radarColumns}>
              <View style={styles.radarColumn}>
                <Text style={styles.radarSubtitle}>Top DY (12m)</Text>
                {radarData.topDividend.slice(0, 3).map((item) => (
                  <Pressable key={`dy-${item.ticker}`} onPress={() => openFiiByTicker(item.ticker)}>
                    <Text style={styles.radarLine}>
                      {item.ticker} • DY {formatDecimalBR(item.dy, 1)}%
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.radarColumn}>
                <Text style={styles.radarSubtitle}>Maior desconto P/VP</Text>
                {radarData.topDiscount.slice(0, 3).map((item) => (
                  <Pressable key={`pvp-${item.ticker}`} onPress={() => openFiiByTicker(item.ticker)}>
                    <Text style={styles.radarLine}>
                      {item.ticker} • P/VP {item.pvp !== null ? formatDecimalBR(item.pvp, 2) : "-"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.comparatorCard}>
          <View style={styles.comparatorHeader}>
            <Text style={styles.comparatorTitle}>Comparador rápido</Text>
            <Pressable onPress={() => setCompareOpen((prev) => !prev)} style={styles.comparatorToggleBtn}>
              <Text style={styles.comparatorToggleText}>{compareOpen ? "Fechar" : "Comparar"}</Text>
            </Pressable>
          </View>

          {compareOpen ? (
            <>
              <TextInput
                value={compareQuery}
                onChangeText={setCompareQuery}
                placeholder="Buscar ticker, nome ou categoria"
                style={styles.compareInput}
              />
              <View style={styles.compareSelectedRow}>
                {compareItems.length === 0 ? (
                  <Text style={styles.compareHint}>Selecione até 3 ativos.</Text>
                ) : (
                  compareItems.map((item) => {
                    const key = `${item.assetClass}:${item.ticker}`;
                    return (
                      <Pressable key={key} onPress={() => toggleCompareKey(key)} style={styles.compareSelectedChip}>
                        <Text style={styles.compareSelectedChipText}>{item.ticker} ×</Text>
                      </Pressable>
                    );
                  })
                )}
              </View>

              <View style={styles.compareCandidatesRow}>
                {compareCandidates.map((item) => {
                  const key = `${item.assetClass}:${item.ticker}`;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => toggleCompareKey(key)}
                      disabled={compareKeys.length >= 3}
                      style={styles.compareCandidateChip}
                    >
                      <Text style={styles.compareCandidateText}>
                        + {item.ticker} ({assetClassLabel(item.assetClass)})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {compareItems.length >= 2 ? (
                <View style={styles.compareGrid}>
                  {compareItems.map((item) => (
                    <Pressable
                      key={`${item.assetClass}:${item.ticker}`}
                      style={styles.compareCard}
                      onPress={() => openCatalogAsset(item)}
                    >
                      <Text style={styles.compareTicker}>{item.ticker}</Text>
                      <Text style={styles.compareMeta}>{assetClassLabel(item.assetClass)}</Text>
                      <Text style={styles.compareMetric}>Preço: {formatCurrencyBRL(item.price)}</Text>
                      <Text style={styles.compareMetric}>DY: {formatDecimalBR(item.dividendYield12m, 1)}%</Text>
                      <Text style={styles.compareMetric}>
                        P/VP: {typeof item.pvp === "number" ? formatDecimalBR(item.pvp, 2) : "-"}
                      </Text>
                      <Text style={styles.compareMetric}>
                        P/L: {typeof item.pl === "number" ? formatDecimalBR(item.pl, 1) : "-"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.helper}>Carregando ativos...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Falha ao carregar</Text>
            <Text style={styles.helper}>{normalizeUtf8Text(error)}</Text>
            <Pressable onPress={handleRefresh} style={styles.button}>
              <Text style={styles.buttonText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error ? (
          <>
            <View style={styles.filters}>
              <View style={styles.filtersHeader}>
                <Text style={styles.filtersTitle}>Filtros</Text>
                <View style={styles.filtersActions}>
                  <Pressable
                    onPress={clearFilters}
                    style={[styles.clearBtn, !hasActiveFilters && styles.clearBtnDisabled]}
                    disabled={!hasActiveFilters}
                  >
                    <Text style={[styles.clearText, !hasActiveFilters && styles.clearTextDisabled]}>Limpar</Text>
                  </Pressable>
                  <Pressable onPress={() => setFiltersOpen((prev) => !prev)} style={styles.toggleBtn}>
                    <Text style={styles.toggleText}>{filtersOpen ? "Fechar" : "Filtrar"}</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.resultsLabel}>
                {visibleItems} de {totalItems} ativos
              </Text>

              {filtersOpen ? (
                <>
                  <Text style={styles.filterLabel}>Categoria</Text>
                  <View style={styles.chipRow}>
                    {categoryOptions.map((value) => {
                      const active = selectedCategories.includes(value);
                      return (
                        <Pressable
                          key={value}
                          onPress={() => toggleCategory(value)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{value}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.filterLabel}>Favoritos</Text>
                  <View style={styles.chipRow}>
                    <Pressable
                      onPress={() => setOnlyFavorites((prev) => !prev)}
                      style={[styles.chip, onlyFavorites && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, onlyFavorites && styles.chipTextActive]}>
                        Mostrar somente favoritos
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.filterLabel}>Dividend Yield (12m)</Text>
                  <View style={styles.rangeRow}>
                    <TextInput
                      value={minDy}
                      onChangeText={setMinDy}
                      placeholder="Mínimo"
                      keyboardType="numeric"
                      style={styles.inputSmall}
                    />
                    <TextInput
                      value={maxDy}
                      onChangeText={setMaxDy}
                      placeholder="Máximo"
                      keyboardType="numeric"
                      style={styles.inputSmall}
                    />
                  </View>

                  <Text style={styles.filterLabel}>Ordenação</Text>
                  <View style={styles.chipRow}>
                    {SORT_OPTIONS.map((option) => {
                      const active = sortBy === option.id;
                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => setSortBy(option.id)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </View>

            {visibleItems === 0 ? (
              <View style={styles.center}>
                <Text style={styles.helper}>Nenhum ativo encontrado com esse filtro.</Text>
              </View>
            ) : assetTab === "FII" ? (
              <FlatList
                data={sortedFiis}
                keyExtractor={(item) => item.ticker}
                renderItem={({ item }) => (
                  <FiiCard
                    fii={item}
                    updatedAt={fiiUpdatedAt}
                    fundamentalsUpdatedAt={fundamentalsUpdatedAt}
                    isFavorite={favoriteTickers.has(item.ticker)}
                  />
                )}
                contentContainerStyle={styles.list}
              />
            ) : (
              <FlatList
                data={sortedMarketAssets}
                keyExtractor={(item) => item.ticker}
                renderItem={({ item }) => (
                  <MarketAssetCard asset={item} isFavorite={favoriteTickers.has(item.ticker)} />
                )}
                contentContainerStyle={styles.list}
              />
            )}
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef3f8" },
  container: { flex: 1, padding: 16 },
  heroCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#0f172a",
    gap: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heroTitleWrap: { flex: 1 },
  title: { fontSize: 26, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 13, color: "#bfdbfe" },
  countryButton: {
    alignItems: "center",
    gap: 3,
  },
  countryFlagCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  countryFlag: { fontSize: 17 },
  countryLabel: { fontSize: 10, color: "#bfdbfe", fontWeight: "700" },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 6 },
  heroStatPill: {
    flex: 1,
    backgroundColor: "#111f3f",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  heroStatLabel: { fontSize: 11, color: "#9fb2d8" },
  heroStatValue: { fontSize: 15, color: "#fff", fontWeight: "800", marginTop: 2 },
  segmentRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tabRow: { flexDirection: "row", gap: 8, flex: 1 },
  tabChip: {
    borderWidth: 1,
    borderColor: "#c2d1e8",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  tabChipActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  tabChipText: { fontSize: 12, color: "#334155", fontWeight: "700" },
  tabChipTextActive: { color: "#fff" },
  refreshBtn: {
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: "#111827",
  },
  refreshText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  alertCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    gap: 4,
  },
  alertTitle: { fontSize: 13, fontWeight: "800", color: "#b45309" },
  alertLine: { fontSize: 12, color: "#78350f" },
  alertHint: { fontSize: 11, color: "#92400e", marginTop: 2 },
  radarCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c7f9cc",
    backgroundColor: "#f0fff4",
    gap: 8,
  },
  radarTitle: { fontSize: 14, fontWeight: "800", color: "#166534" },
  radarColumns: { flexDirection: "row", gap: 12 },
  radarColumn: { flex: 1, gap: 4 },
  radarSubtitle: { fontSize: 12, fontWeight: "700", color: "#15803d" },
  radarLine: { fontSize: 12, color: "#14532d" },
  comparatorCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    padding: 12,
    gap: 8,
  },
  comparatorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  comparatorTitle: { fontSize: 14, fontWeight: "800", color: "#111" },
  comparatorToggleBtn: {
    borderRadius: 8,
    backgroundColor: "#0f172a",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  comparatorToggleText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  compareInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
  },
  compareSelectedRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  compareHint: { fontSize: 12, color: "#64748b" },
  compareSelectedChip: {
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compareSelectedChipText: { fontSize: 12, color: "#111827", fontWeight: "700" },
  compareCandidatesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  compareCandidateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  compareCandidateText: { fontSize: 11, color: "#334155" },
  compareGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  compareCard: {
    flexGrow: 1,
    minWidth: 110,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    gap: 2,
    backgroundColor: "#f8fafc",
  },
  compareTicker: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  compareMeta: { fontSize: 11, color: "#475569", marginBottom: 2 },
  compareMetric: { fontSize: 11, color: "#1e293b" },
  banner: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerSnapshot: { borderColor: "#0a7a0a", backgroundColor: "#eaf7ea" },
  bannerMock: { borderColor: "#a36a00", backgroundColor: "#fff4e5" },
  bannerText: { fontSize: 12, color: "#333" },
  bannerSubText: { fontSize: 11, color: "#555", marginTop: 4 },
  qualityCard: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dce6f8",
    backgroundColor: "#f5f9ff",
    gap: 4,
  },
  qualityTitle: { fontSize: 13, fontWeight: "700", color: "#1b3558" },
  qualityLine: { fontSize: 12, color: "#243b55" },
  qualityHint: { fontSize: 11, color: "#516b8a", marginTop: 4 },
  list: { paddingTop: 12 },
  filters: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#fff",
    gap: 8,
  },
  filtersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filtersActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  filtersTitle: { fontSize: 16, fontWeight: "700" },
  filterLabel: { fontSize: 12, color: "#555" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#f7f7f7",
  },
  chipActive: { backgroundColor: "#111", borderColor: "#111" },
  chipText: { fontSize: 12, color: "#333" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  rangeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  inputSmall: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#111",
  },
  clearText: { fontSize: 12, fontWeight: "700", color: "#111" },
  clearBtnDisabled: { borderColor: "#bbb" },
  clearTextDisabled: { color: "#999" },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#111",
  },
  toggleText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  resultsLabel: { fontSize: 12, color: "#666" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  helper: { fontSize: 13, color: "#555", textAlign: "center" },
  errorTitle: { fontSize: 16, fontWeight: "700" },
  button: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#111",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
