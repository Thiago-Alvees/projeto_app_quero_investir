import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getPortfolioById,
  getPortfolioStorageMode,
  isPortfolioCloudEnabled,
  savePortfolio,
} from "../../data/services/portfolioService";
import type { PortfolioVisibility } from "../../domain/models/portfolio";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useInvestmentCatalog } from "../hooks/useInvestmentCatalog";
import { formatCurrencyBRL, formatDecimalBR } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "PortfolioForm">;

type AssetClassFilter = "ALL" | "FII" | "STOCK" | "ETF";

const VISIBILITY_OPTIONS: PortfolioVisibility[] = ["PUBLICA", "PRIVADA"];

function parseCurrencyInput(value: string): number | null {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toAssetKey(assetClass: string, ticker: string): string {
  return `${assetClass}:${ticker}`;
}

function formatDateLabel(value?: string | null): string {
  if (!value) return "indisponível";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "indisponível";
  return date.toLocaleString("pt-BR");
}

export default function PortfolioFormScreen({ navigation, route }: Props) {
  const portfolioId = route.params?.portfolioId;
  const isEditMode = Boolean(portfolioId);
  const {
    items: catalogItems,
    loading: catalogLoading,
    source,
    updatedAt,
    refresh,
  } = useInvestmentCatalog();

  const cloudEnabled = isPortfolioCloudEnabled();
  const syncMode = getPortfolioStorageMode();

  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<PortfolioVisibility>("PRIVADA");
  const [monthlyContributionInput, setMonthlyContributionInput] = useState("1000");
  const [monthsInput, setMonthsInput] = useState("24");
  const [reinvestDividends, setReinvestDividends] = useState(true);
  const [assetFilter, setAssetFilter] = useState<AssetClassFilter>("ALL");
  const [selectedAssetKeys, setSelectedAssetKeys] = useState<Set<string>>(new Set());
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!portfolioId) return;

    let active = true;
    setLoadingExisting(true);
    (async () => {
      const existing = await getPortfolioById(portfolioId);
      if (!active) return;

      if (existing) {
        setName(existing.name);
        setVisibility(existing.visibility);
        setMonthlyContributionInput(String(existing.monthlyContribution));
        setMonthsInput(String(existing.months));
        setReinvestDividends(existing.reinvestDividends);
        setSelectedAssetKeys(
          new Set(existing.assets.map((item) => toAssetKey(item.assetClass, item.ticker)))
        );
      }
      setLoadingExisting(false);
    })();

    return () => {
      active = false;
    };
  }, [portfolioId]);

  const filteredAssets = useMemo(() => {
    if (assetFilter === "ALL") return catalogItems;
    return catalogItems.filter((item) => item.assetClass === assetFilter);
  }, [assetFilter, catalogItems]);

  const selectedAssets = useMemo(
    () =>
      catalogItems.filter((asset) =>
        selectedAssetKeys.has(toAssetKey(asset.assetClass, asset.ticker))
      ),
    [catalogItems, selectedAssetKeys]
  );

  const monthlyContribution = parseCurrencyInput(monthlyContributionInput);
  const monthlyByAsset =
    monthlyContribution && selectedAssets.length > 0
      ? monthlyContribution / selectedAssets.length
      : 0;

  function toggleAsset(assetClass: string, ticker: string) {
    const key = toAssetKey(assetClass, ticker);
    setSelectedAssetKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleSave() {
    const monthlyValue = parseCurrencyInput(monthlyContributionInput);
    const monthsValue = parseCurrencyInput(monthsInput);

    if (!name.trim()) {
      Alert.alert("Nome obrigatório", "Digite um nome para a carteira.");
      return;
    }
    if (!monthlyValue || monthlyValue <= 0) {
      Alert.alert("Aporte inválido", "Informe um aporte mensal maior que zero.");
      return;
    }
    if (!monthsValue || monthsValue <= 0) {
      Alert.alert("Prazo inválido", "Informe um prazo em meses maior que zero.");
      return;
    }
    if (selectedAssetKeys.size === 0) {
      Alert.alert("Selecione ativos", "Escolha pelo menos 1 ativo para a carteira.");
      return;
    }

    setSaving(true);
    await savePortfolio({
      id: portfolioId ?? undefined,
      name: name.trim(),
      visibility,
      monthlyContribution: monthlyValue,
      months: Math.max(1, Math.floor(monthsValue)),
      reinvestDividends,
      assets: Array.from(selectedAssetKeys).map((value) => {
        const [assetClass, ticker] = value.split(":");
        return {
          assetClass: assetClass as "FII" | "STOCK" | "ETF",
          ticker,
        };
      }),
    });
    setSaving(false);
    navigation.goBack();
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{isEditMode ? "Editar carteira" : "Nova carteira"}</Text>
        <Text style={styles.subtitle}>
          Carteiras públicas podem ser compartilhadas com amigos.
        </Text>

        <Text style={styles.helper}>
          Base de ativos: {source === "LIVE" ? "atualizada" : "fallback local"}
          {updatedAt ? ` | ${new Date(updatedAt).toLocaleString("pt-BR")}` : ""}
        </Text>
        <Text style={styles.helper}>
          Sincronização de carteiras:{" "}
          {cloudEnabled
            ? syncMode === "CLOUD"
              ? "nuvem ativa"
              : "nuvem indisponível, usando dados locais"
            : "local (configure o Supabase para compartilhamento real)"}
        </Text>

        {loadingExisting ? <Text style={styles.helper}>Carregando carteira...</Text> : null}
        {catalogLoading ? (
          <Text style={styles.helper}>Carregando ativos disponíveis...</Text>
        ) : null}

        <Text style={styles.label}>Nome</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ex: Carteira longo prazo"
          style={styles.input}
        />

        <Text style={styles.label}>Visibilidade</Text>
        <View style={styles.chipRow}>
          {VISIBILITY_OPTIONS.map((option) => {
            const active = visibility === option;
            return (
              <Pressable
                key={option}
                onPress={() => setVisibility(option)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
        {visibility === "PUBLICA" ? (
          <Text style={styles.helper}>
            Um código de compartilhamento será gerado automaticamente ao salvar.
          </Text>
        ) : null}

        <Text style={styles.label}>Aporte mensal total (R$)</Text>
        <TextInput
          value={monthlyContributionInput}
          onChangeText={setMonthlyContributionInput}
          keyboardType="numeric"
          placeholder="1000"
          style={styles.input}
        />

        <Text style={styles.label}>Horizonte (meses)</Text>
        <TextInput
          value={monthsInput}
          onChangeText={setMonthsInput}
          keyboardType="numeric"
          placeholder="24"
          style={styles.input}
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>Reinvestir dividendos automaticamente</Text>
          <Switch
            value={reinvestDividends}
            onValueChange={setReinvestDividends}
            trackColor={{ false: "#ccc", true: "#0a7a0a" }}
          />
        </View>

        <Text style={styles.helper}>
          Aporte estimado por ativo selecionado: {formatCurrencyBRL(monthlyByAsset)}
        </Text>

        <View style={styles.refreshRow}>
          <Text style={styles.label}>Filtrar ativos</Text>
          <Pressable onPress={refresh} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>Atualizar cotações</Text>
          </Pressable>
        </View>

        <View style={styles.chipRow}>
          {(["ALL", "FII", "STOCK", "ETF"] as const).map((value) => {
            const active = assetFilter === value;
            const label =
              value === "ALL"
                ? "Todos"
                : value === "FII"
                  ? "FIIs"
                  : value === "STOCK"
                    ? "Ações"
                    : "ETFs";

            return (
              <Pressable
                key={value}
                onPress={() => setAssetFilter(value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Selecionar ativos</Text>
        <Text style={styles.helper}>
          Ativos disponíveis neste filtro: {filteredAssets.length}
        </Text>
        <View style={styles.assetList}>
          {filteredAssets.map((asset) => {
            const key = toAssetKey(asset.assetClass, asset.ticker);
            const active = selectedAssetKeys.has(key);
            const dyText = Number.isFinite(asset.dividendYield12m)
              ? `${formatDecimalBR(asset.dividendYield12m, 1)}%`
              : "indisponível";
            const updatedText = formatDateLabel(asset.priceUpdatedAt);

            return (
              <Pressable
                key={key}
                onPress={() => toggleAsset(asset.assetClass, asset.ticker)}
                style={[styles.assetChip, active && styles.assetChipActive]}
              >
                <Text style={[styles.assetChipTitle, active && styles.assetChipTitleActive]}>
                  {asset.ticker} | {asset.assetClass}
                </Text>
                <Text style={[styles.assetChipSubtitle, active && styles.assetChipSubtitleActive]}>
                  {asset.category} | {asset.name}
                </Text>
                <Text style={[styles.assetChipSubtitle, active && styles.assetChipSubtitleActive]}>
                  Cotação: {formatCurrencyBRL(asset.price)} | DY (12m): {dyText}
                </Text>
                <Text style={[styles.assetChipSubtitle, active && styles.assetChipSubtitleActive]}>
                  Última atualização da cotação: {updatedText}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.helper}>Selecionados: {selectedAssets.length} ativo(s)</Text>

        <Pressable
          onPress={handleSave}
          style={[styles.primaryBtn, (saving || catalogLoading) && styles.primaryBtnDisabled]}
          disabled={saving || catalogLoading}
        >
          <Text style={styles.primaryBtnText}>{saving ? "Salvando..." : "Salvar carteira"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: {
    padding: 16,
    gap: 8,
    paddingBottom: 32,
  },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 13, color: "#555", marginBottom: 4 },
  label: { fontSize: 13, color: "#444", marginTop: 6 },
  helper: { fontSize: 12, color: "#666" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  refreshRow: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  refreshBtn: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  refreshBtnText: { fontSize: 12, color: "#111", fontWeight: "700" },
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
  assetList: { gap: 8 },
  assetChip: {
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fafafa",
    gap: 4,
  },
  assetChipActive: {
    borderColor: "#111",
    backgroundColor: "#f1f1f1",
  },
  assetChipTitle: { fontSize: 13, fontWeight: "700", color: "#111" },
  assetChipTitleActive: { color: "#111" },
  assetChipSubtitle: { fontSize: 12, color: "#555" },
  assetChipSubtitleActive: { color: "#333" },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
});
