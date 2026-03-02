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

import type { InvestmentPortfolio } from "../../domain/models/portfolio";
import {
  getPortfolioStorageMode,
  isPortfolioCloudEnabled,
  listPortfolios,
  listPublicPortfolios,
} from "../../data/services/portfolioService";
import { simulatePortfolio } from "../../domain/rules/portfolioSimulator";
import { useInvestmentCatalog } from "../hooks/useInvestmentCatalog";
import { formatCurrencyBRL } from "../utils/format";

type PortfolioTab = "MINE" | "PUBLIC";

export default function PortfolioListScreen() {
  const navigation = useNavigation<any>();
  const [mine, setMine] = useState<InvestmentPortfolio[]>([]);
  const [publicItems, setPublicItems] = useState<InvestmentPortfolio[]>([]);
  const [tab, setTab] = useState<PortfolioTab>("MINE");
  const [loading, setLoading] = useState(true);
  const [syncMode, setSyncMode] = useState<"CLOUD" | "LOCAL">(getPortfolioStorageMode());
  const { byKey, source, updatedAt } = useInvestmentCatalog();

  const loadData = useCallback(() => {
    let active = true;

    (async () => {
      setLoading(true);
      const [myPortfolios, publicPortfolios] = await Promise.all([
        listPortfolios(),
        listPublicPortfolios(),
      ]);

      if (!active) return;
      setMine(myPortfolios);
      setPublicItems(publicPortfolios);
      setSyncMode(getPortfolioStorageMode());
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(loadData);

  const visible = tab === "MINE" ? mine : publicItems;

  const projectedCards = useMemo(
    () =>
      visible.map((portfolio) => ({
        portfolio,
        projection: simulatePortfolio(portfolio, byKey),
      })),
    [visible, byKey]
  );

  const cloudEnabled = isPortfolioCloudEnabled();
  const canCreate = tab === "MINE";

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Carteiras</Text>
            <Text style={styles.subtitle}>
              Monte cenários, acompanhe retornos e compartilhe carteiras públicas.
            </Text>
            <Text style={styles.catalogStatus}>
              Base: {source === "LIVE" ? "atualizada" : "fallback local"}
              {updatedAt ? ` | ${new Date(updatedAt).toLocaleString("pt-BR")}` : ""}
            </Text>
            <Text style={styles.catalogStatus}>
              Sincronização:{" "}
              {cloudEnabled
                ? syncMode === "CLOUD"
                  ? "nuvem ativa"
                  : "nuvem indisponível, usando dados locais"
                : "local (configure o Supabase para publicar)"}
            </Text>
          </View>
          {canCreate ? (
            <Pressable
              onPress={() => navigation.navigate("PortfolioForm")}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Nova</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.tabRow}>
          {([
            ["MINE", "Minhas"],
            ["PUBLIC", "Públicas"],
          ] as Array<[PortfolioTab, string]>).map(([value, label]) => {
            const active = tab === value;
            return (
              <Pressable
                key={value}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setTab(value)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator />
            <Text style={styles.emptyText}>Carregando carteiras...</Text>
          </View>
        ) : projectedCards.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {tab === "MINE"
                ? "Você ainda não criou uma carteira."
                : "Nenhuma carteira pública disponível agora."}
            </Text>
            <Text style={styles.emptyText}>
              {tab === "MINE"
                ? 'Toque em "Nova" para montar sua carteira.'
                : "Quando usuários marcarem uma carteira como pública, ela aparece aqui."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={projectedCards}
            keyExtractor={(item) => item.portfolio.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isPublic = item.portfolio.visibility === "PUBLICA";
              return (
                <Pressable
                  style={styles.card}
                  onPress={() =>
                    navigation.navigate("PortfolioDetail", {
                      portfolioId: item.portfolio.id,
                      readOnly: tab === "PUBLIC",
                    })
                  }
                >
                  <View style={styles.row}>
                    <Text style={styles.cardTitle}>{item.portfolio.name}</Text>
                    <Text
                      style={[
                        styles.visibility,
                        isPublic ? styles.visibilityPublic : styles.visibilityPrivate,
                      ]}
                    >
                      {item.portfolio.visibility}
                    </Text>
                  </View>

                  <Text style={styles.meta}>
                    Ativos: {item.portfolio.assets.length} | Aporte mensal:{" "}
                    {formatCurrencyBRL(item.portfolio.monthlyContribution)}
                  </Text>
                  <Text style={styles.meta}>Horizonte: {item.portfolio.months} meses</Text>
                  {isPublic && item.portfolio.shareCode ? (
                    <Text style={styles.meta}>
                      Código de compartilhamento: {item.portfolio.shareCode}
                    </Text>
                  ) : null}

                  {item.projection ? (
                    <>
                      <Text style={styles.resultLine}>
                        Valor final estimado: {formatCurrencyBRL(item.projection.finalValue)}
                      </Text>
                      <Text style={styles.resultLine}>
                        Ganho estimado: {formatCurrencyBRL(item.projection.gain)}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.meta}>Sem dados suficientes para projetar.</Text>
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f6f6" },
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerInfo: { flex: 1, paddingRight: 8 },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 13, color: "#555", marginTop: 4, maxWidth: 280 },
  catalogStatus: { fontSize: 11, color: "#666", marginTop: 4 },
  primaryBtn: {
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  tabRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  tabBtn: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  tabBtnActive: { backgroundColor: "#111", borderColor: "#111" },
  tabText: { fontSize: 12, color: "#333", fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  empty: {
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    backgroundColor: "#fff",
    gap: 8,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptyText: { fontSize: 13, color: "#555", textAlign: "center" },
  list: { paddingTop: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    padding: 14,
    marginBottom: 12,
    gap: 5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", flex: 1 },
  visibility: {
    fontSize: 11,
    fontWeight: "800",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  visibilityPublic: { color: "#0a7a0a", borderColor: "#0a7a0a" },
  visibilityPrivate: { color: "#666", borderColor: "#999" },
  meta: { fontSize: 12, color: "#555" },
  resultLine: { fontSize: 13, color: "#111", fontWeight: "600" },
});
