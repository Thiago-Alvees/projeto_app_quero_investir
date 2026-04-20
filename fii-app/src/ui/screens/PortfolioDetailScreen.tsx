import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import { deletePortfolio, getPortfolioById } from "../../data/services/portfolioService";
import { getSupabaseSessionUser } from "../../data/services/supabase/client";
import type { InvestmentPortfolio } from "../../domain/models/portfolio";
import {
  simulatePortfolio,
  simulatePortfolioTimeline,
} from "../../domain/rules/portfolioSimulator";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useInvestmentCatalog } from "../hooks/useInvestmentCatalog";
import { formatCurrencyBRL, formatDecimalBR } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "PortfolioDetail">;

function toAssetKey(assetClass: string, ticker: string): string {
  return `${assetClass}:${ticker}`;
}

function formatDateLabel(value?: string | null): string {
  if (!value) return "indisponível";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "indisponível";
  return date.toLocaleString("pt-BR");
}

export default function PortfolioDetailScreen({ route, navigation }: Props) {
  const { portfolioId, readOnly } = route.params;
  const [portfolio, setPortfolio] = useState<InvestmentPortfolio | null>(null);
  const [hasAccountSession, setHasAccountSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const { byKey, source, updatedAt } = useInvestmentCatalog();

  useEffect(() => {
    let active = true;
    (async () => {
      const [data, sessionUser] = await Promise.all([
        getPortfolioById(portfolioId),
        getSupabaseSessionUser(),
      ]);
      if (!active) return;
      setPortfolio(data);
      setHasAccountSession(
        Boolean(sessionUser && !sessionUser.isAnonymous && sessionUser.email)
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [portfolioId]);

  const projection = useMemo(
    () => (portfolio ? simulatePortfolio(portfolio, byKey) : null),
    [portfolio, byKey]
  );
  const timeline = useMemo(
    () => (portfolio ? simulatePortfolioTimeline(portfolio, byKey) : []),
    [portfolio, byKey]
  );

  const canEdit = !readOnly && hasAccountSession;

  async function handleDelete() {
    if (!portfolio || !canEdit) return;
    Alert.alert("Excluir carteira", "Deseja excluir esta carteira?", [
      { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePortfolio(portfolio.id);
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                "Falha ao excluir",
                error instanceof Error
                  ? error.message
                  : "Não foi possível excluir a carteira agora."
              );
            }
          },
        },
      ]);
  }

  async function handleShare() {
    if (!portfolio || portfolio.visibility !== "PUBLICA" || !projection) return;

    const summary = [
      `Carteira: ${portfolio.name}`,
      `Aporte mensal: ${formatCurrencyBRL(portfolio.monthlyContribution)}`,
      `Prazo: ${portfolio.months} meses`,
      `Valor final estimado: ${formatCurrencyBRL(projection.finalValue)}`,
      `Ganho estimado: ${formatCurrencyBRL(projection.gain)}`,
      `Renda mensal estimada ao final: ${formatCurrencyBRL(projection.monthlyIncomeAtEnd)}`,
      portfolio.shareCode ? `Código de compartilhamento: ${portfolio.shareCode}` : null,
      "",
      "Compartilhado via Quero Investir (conteúdo educacional).",
    ]
      .filter(Boolean)
      .join("\n");

    await Share.share({ message: summary });
  }

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.helper}>Carregando carteira...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!portfolio) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.helper}>Carteira não encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{portfolio.name}</Text>
            <Text style={styles.subtitle}>
              Visibilidade: <Text style={styles.visibilityValue}>{portfolio.visibility}</Text>
            </Text>
            {portfolio.shareCode ? (
              <Text style={styles.subtitle}>
                Código público: <Text style={styles.visibilityValue}>{portfolio.shareCode}</Text>
              </Text>
            ) : null}
            <Text style={styles.catalogStatus}>
              Base de preços: {source === "SNAPSHOT" ? "snapshot curado" : "fallback local"}
              {updatedAt ? ` | ${new Date(updatedAt).toLocaleString("pt-BR")}` : ""}
            </Text>
            {readOnly ? (
              <Text style={styles.readOnlyHint}>
                Modo somente leitura: carteira pública de outro usuário.
              </Text>
            ) : !hasAccountSession ? (
              <Text style={styles.readOnlyHint}>
                Entre com sua conta para editar ou excluir esta carteira.
              </Text>
            ) : null}
          </View>
          {canEdit ? (
            <Pressable
              onPress={() => navigation.navigate("PortfolioForm", { portfolioId: portfolio.id })}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Editar</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLine}>
            Aporte mensal: {formatCurrencyBRL(portfolio.monthlyContribution)}
          </Text>
          <Text style={styles.summaryLine}>Horizonte: {portfolio.months} meses</Text>
          <Text style={styles.summaryLine}>
            Reinvestimento de dividendos: {portfolio.reinvestDividends ? "Sim" : "Não"}
          </Text>
        </View>

        {projection ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Projeção da carteira</Text>
            <Text style={styles.resultLine}>
              Total investido: {formatCurrencyBRL(projection.invested)}
            </Text>
            <Text style={styles.resultLine}>
              Valor final estimado: {formatCurrencyBRL(projection.finalValue)}
            </Text>
            <Text style={styles.resultLine}>
              Ganho estimado: {formatCurrencyBRL(projection.gain)}
            </Text>
            <Text style={styles.resultLine}>
              Renda mensal estimada ao final: {formatCurrencyBRL(projection.monthlyIncomeAtEnd)}
            </Text>
          </View>
        ) : (
          <Text style={styles.helper}>Sem dados suficientes para projetar a carteira.</Text>
        )}

        {timeline.length ? (
          <View style={styles.timelineCard}>
            <Text style={styles.resultTitle}>Evolução estimada (mês a mês)</Text>
            {timeline.slice(-6).map((point) => (
              <View key={point.month} style={styles.timelineRow}>
                <Text style={styles.timelineMonth}>M{point.month}</Text>
                <Text style={styles.timelineValue}>
                  {formatCurrencyBRL(point.estimatedValue)}
                </Text>
                <Text style={styles.timelineMeta}>
                  Renda: {formatCurrencyBRL(point.estimatedIncome)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Composição e contribuição por ativo</Text>
        <View style={styles.list}>
          {portfolio.assets.map((asset) => {
            const catalog = byKey.get(toAssetKey(asset.assetClass, asset.ticker));
            const name = catalog?.name ?? asset.ticker;
            const expected = catalog?.expectedAnnualReturn;
            const dy = catalog?.dividendYield12m;
            const contribution =
              portfolio.assets.length > 0
                ? portfolio.monthlyContribution / portfolio.assets.length
                : 0;

            return (
              <View key={`${asset.assetClass}:${asset.ticker}`} style={styles.itemCard}>
                <Text style={styles.itemTitle}>
                  {asset.ticker} | {asset.assetClass}
                </Text>
                <Text style={styles.itemMeta}>{name}</Text>
                <Text style={styles.itemMeta}>
                  Aporte mensal estimado: {formatCurrencyBRL(contribution)}
                </Text>
                <Text style={styles.itemMeta}>
                  Cotação base: {catalog ? formatCurrencyBRL(catalog.price) : "indisponível"}
                </Text>
                <Text style={styles.itemMeta}>
                  Última atualização da cotação:{" "}
                  {catalog ? formatDateLabel(catalog.priceUpdatedAt) : "indisponível"}
                </Text>
                <Text style={styles.itemMeta}>
                  Retorno anual base:{" "}
                  {typeof expected === "number"
                    ? `${formatDecimalBR(expected, 1)}%`
                    : "indisponível"}
                </Text>
                <Text style={styles.itemMeta}>
                  DY base:{" "}
                  {typeof dy === "number" ? `${formatDecimalBR(dy, 1)}%` : "indisponível"}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.actionsRow}>
          {canEdit ? (
            <Pressable onPress={handleDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>Excluir carteira</Text>
            </Pressable>
          ) : null}
          {portfolio.visibility === "PUBLICA" ? (
            <Pressable onPress={handleShare} style={styles.shareBtn}>
              <Text style={styles.shareBtnText}>Compartilhar</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.disclaimer}>
          Projeção educativa. Não considera impostos, taxas, variação real de mercado e não é
          recomendação de investimento.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 16, paddingBottom: 32, gap: 10 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  headerInfo: { flex: 1 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 13, color: "#555", marginTop: 4 },
  catalogStatus: { fontSize: 11, color: "#666", marginTop: 4 },
  readOnlyHint: { fontSize: 11, color: "#8a5500", marginTop: 6 },
  visibilityValue: { fontWeight: "700", color: "#111" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryBtnText: { fontWeight: "700", color: "#111" },
  summaryCard: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    borderRadius: 10,
    backgroundColor: "#fafafa",
    gap: 4,
  },
  summaryLine: { fontSize: 13, color: "#333" },
  resultCard: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d9e8ff",
    borderRadius: 10,
    backgroundColor: "#f3f8ff",
    gap: 4,
  },
  resultTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  resultLine: { fontSize: 13, color: "#111" },
  sectionTitle: { marginTop: 10, fontSize: 16, fontWeight: "700" },
  timelineCard: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#fff",
    gap: 8,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  timelineMonth: { fontSize: 12, fontWeight: "700", color: "#111827", width: 30 },
  timelineValue: { fontSize: 12, color: "#111", flex: 1 },
  timelineMeta: { fontSize: 11, color: "#6b7280" },
  list: { gap: 8 },
  itemCard: {
    borderWidth: 1,
    borderColor: "#e6e6e6",
    borderRadius: 10,
    padding: 10,
    gap: 3,
    backgroundColor: "#fff",
  },
  itemTitle: { fontSize: 13, fontWeight: "700", color: "#111" },
  itemMeta: { fontSize: 12, color: "#555" },
  actionsRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deleteBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#b00020",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  deleteBtnText: { color: "#b00020", fontWeight: "700" },
  shareBtn: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  shareBtnText: { color: "#fff", fontWeight: "700" },
  helper: { fontSize: 14, color: "#666" },
  disclaimer: { marginTop: 8, fontSize: 12, color: "#666" },
});
