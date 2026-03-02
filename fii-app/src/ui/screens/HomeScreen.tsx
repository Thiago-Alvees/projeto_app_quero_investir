import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Fii } from "../../domain/models/fii";
import type { FiiType } from "../../domain/models/fiiType";
import type { MarketAsset } from "../../domain/models/marketAsset";
import { FII_TYPES } from "../../domain/models/fiiType";
import { getFavorites } from "../../data/services/favoritesService";
import FiiCard from "../components/FiiCard";
import MarketAssetCard from "../components/MarketAssetCard";
import { useFiiList } from "../hooks/useFiiList";
import { useMarketAssets } from "../hooks/useMarketAssets";
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

function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR");
}

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

function toCoverage(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
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

export default function HomeScreen() {
  const {
    fiis,
    loading: fiiLoading,
    error: fiiError,
    source: fiiSource,
    updatedAt: fiiUpdatedAt,
    fundamentalsUpdatedAt,
    refresh: refreshFiis,
  } = useFiiList();

  const {
    assets: marketAssets,
    loading: marketLoading,
    error: marketError,
    source: marketSource,
    updatedAt: marketUpdatedAt,
    refresh: refreshMarket,
  } = useMarketAssets();

  const [assetTab, setAssetTab] = useState<AssetTab>("FII");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [minDy, setMinDy] = useState("");
  const [maxDy, setMaxDy] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [favoriteTickers, setFavoriteTickers] = useState<Set<string>>(new Set());

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

  const fiiUpdatedAtLabel = formatUpdatedAt(fiiUpdatedAt);
  const fundamentalsUpdatedAtLabel = formatUpdatedAt(fundamentalsUpdatedAt);
  const marketUpdatedAtLabel = formatUpdatedAt(marketUpdatedAt);
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

  const qualityMetrics = useMemo(() => {
    if (assetTab === "FII") {
      const total = fiis.length;
      let withPrice = 0;
      let withVp = 0;
      let withDy = 0;
      let withPl = 0;
      let dyInReview = 0;

      for (const fii of fiis) {
        if (Number.isFinite(fii.price) && fii.price > 0) withPrice += 1;
        if (typeof fii.vp === "number" && Number.isFinite(fii.vp) && fii.vp > 0) withVp += 1;
        if (typeof fii.pl === "number" && Number.isFinite(fii.pl) && fii.pl > 0) withPl += 1;

        const hasDy = Number.isFinite(fii.dividendYield12m) && fii.dividendYield12m > 0;
        if (hasDy) {
          withDy += 1;
        } else if (fii.dyStatus === "APURACAO") {
          dyInReview += 1;
        }
      }

      return {
        title: "Qualidade dos dados de FIIs",
        total,
        lines: [
          `Cobertura de preço: ${withPrice}/${total} (${toCoverage(withPrice, total)})`,
          `Cobertura de VP: ${withVp}/${total} (${toCoverage(withVp, total)})`,
          `Cobertura de DY: ${withDy}/${total} (${toCoverage(withDy, total)})`,
          `Cobertura de PL: ${withPl}/${total} (${toCoverage(withPl, total)})`,
        ],
        hint:
          dyInReview > 0
            ? `DY em apuração para ${dyInReview} fundo(s).`
            : "Indicadores com boa cobertura para análise inicial.",
      };
    }

    const total = activeMarketAssets.length;
    let withPrice = 0;
    let withDy = 0;
    let withPvp = 0;
    let withPl = 0;
    let withFee = 0;

    for (const asset of activeMarketAssets) {
      if (Number.isFinite(asset.price) && asset.price > 0) withPrice += 1;
      if (typeof asset.dividendYield12m === "number" && Number.isFinite(asset.dividendYield12m)) {
        withDy += 1;
      }
      if (typeof asset.pvp === "number" && Number.isFinite(asset.pvp)) withPvp += 1;
      if (typeof asset.pl === "number" && Number.isFinite(asset.pl)) withPl += 1;
      if (typeof asset.expenseRatio === "number" && Number.isFinite(asset.expenseRatio)) withFee += 1;
    }

    return {
      title: assetTab === "STOCK" ? "Qualidade dos dados de ações" : "Qualidade dos dados de ETFs",
      total,
      lines:
        assetTab === "STOCK"
          ? [
              `Cobertura de preço: ${withPrice}/${total} (${toCoverage(withPrice, total)})`,
              `Cobertura de P/VP: ${withPvp}/${total} (${toCoverage(withPvp, total)})`,
              `Cobertura de P/L: ${withPl}/${total} (${toCoverage(withPl, total)})`,
              `Cobertura de DY: ${withDy}/${total} (${toCoverage(withDy, total)})`,
            ]
          : [
              `Cobertura de preço: ${withPrice}/${total} (${toCoverage(withPrice, total)})`,
              `Cobertura de taxa: ${withFee}/${total} (${toCoverage(withFee, total)})`,
              `Cobertura de DY: ${withDy}/${total} (${toCoverage(withDy, total)})`,
            ],
      hint: "Preços de ações e ETFs atualizados via BRAPI com fallback local.",
    };
  }, [assetTab, fiis, activeMarketAssets]);

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

  const totalItems = assetTab === "FII" ? fiis.length : activeMarketAssets.length;
  const visibleItems = assetTab === "FII" ? sortedFiis.length : sortedMarketAssets.length;
  const loading = assetTab === "FII" ? fiiLoading : marketLoading;
  const error = assetTab === "FII" ? fiiError : marketError;

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Mercado</Text>
            <Text style={styles.subtitle}>Análises simples para FIIs, ações e ETFs</Text>
          </View>
        </View>

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

        <View style={styles.updateRow}>
          <Pressable onPress={handleRefresh} style={styles.refreshBtn} disabled={fiiLoading || marketLoading}>
            <Text style={styles.refreshText}>
              {fiiLoading || marketLoading ? "..." : "Atualizar dados"}
            </Text>
          </Pressable>
          <Text style={styles.updateHint}>
            {assetTab === "FII"
              ? fiiSource === "SNAPSHOT"
                ? "Snapshot diário ativo"
                : "Fallback local ativo"
              : marketSource === "BRAPI"
                ? "Preços via BRAPI"
                : "Fallback local ativo"}
          </Text>
        </View>

        {assetTab === "FII" && !fiiLoading && !fiiError ? (
          <View
            style={[
              styles.banner,
              fiiSource === "SNAPSHOT" ? styles.bannerSnapshot : styles.bannerMock,
            ]}
          >
            <Text style={styles.bannerText}>
              {fiiSource === "SNAPSHOT"
                ? "Preços atualizados por snapshot diário."
                : "Usando dados locais porque o snapshot não respondeu."}
            </Text>
            {fiiUpdatedAtLabel ? (
              <Text style={styles.bannerSubText}>Preço atualizado em: {fiiUpdatedAtLabel}</Text>
            ) : null}
            {fundamentalsUpdatedAtLabel ? (
              <Text style={styles.bannerSubText}>
                Fundamentos atualizados em: {fundamentalsUpdatedAtLabel}
              </Text>
            ) : (
              <Text style={styles.bannerSubText}>Fundamentos usando fallback local.</Text>
            )}
          </View>
        ) : null}

        {assetTab !== "FII" && !marketLoading ? (
          <View style={[styles.banner, marketSource === "BRAPI" ? styles.bannerSnapshot : styles.bannerMock]}>
            <Text style={styles.bannerText}>
              {marketSource === "BRAPI"
                ? "Cotações de ações e ETFs atualizadas via BRAPI."
                : "Usando cotações locais porque a BRAPI não respondeu."}
            </Text>
            {marketUpdatedAtLabel ? (
              <Text style={styles.bannerSubText}>Cotação atualizada em: {marketUpdatedAtLabel}</Text>
            ) : null}
          </View>
        ) : null}

        {!loading ? (
          <View style={styles.qualityCard}>
            <Text style={styles.qualityTitle}>{qualityMetrics.title}</Text>
            {qualityMetrics.lines.map((line) => (
              <Text key={line} style={styles.qualityLine}>
                {line}
              </Text>
            ))}
            <Text style={styles.qualityHint}>{qualityMetrics.hint}</Text>
          </View>
        ) : null}

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
  safe: { flex: 1, backgroundColor: "#f6f6f6" },
  container: { flex: 1, padding: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 14, color: "#555", marginTop: 4 },
  tabRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  tabChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  tabChipActive: { backgroundColor: "#111", borderColor: "#111" },
  tabChipText: { fontSize: 12, color: "#333", fontWeight: "600" },
  tabChipTextActive: { color: "#fff" },
  updateRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  refreshBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111",
  },
  refreshText: { color: "#fff", fontWeight: "700" },
  updateHint: { fontSize: 12, color: "#555", flex: 1, textAlign: "right" },
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
