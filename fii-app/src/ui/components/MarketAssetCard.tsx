import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import type { MarketAsset } from "../../domain/models/marketAsset";
import { analyzeMarketAsset } from "../../domain/rules/marketValuation";
import { formatCurrencyBRL, formatDecimalBR } from "../utils/format";

type Props = {
  asset: MarketAsset;
  isFavorite: boolean;
};

function formatUpdatedAt(value?: string | null): string {
  if (!value) return "indisponível";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "indisponível";
  return date.toLocaleString("pt-BR");
}

export default function MarketAssetCard({ asset, isFavorite }: Props) {
  const navigation = useNavigation<any>();
  const analysis = useMemo(() => analyzeMarketAsset(asset), [asset]);
  const hasPrice = Number.isFinite(asset.price) && asset.price > 0;

  return (
    <Pressable onPress={() => navigation.navigate("MarketAssetDetail", { asset })} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.tickerRow}>
          <Text style={styles.ticker}>{asset.ticker}</Text>
          {isFavorite ? <Text style={styles.favoriteBadge}>FAV</Text> : null}
        </View>
        <Text style={styles.price}>
          {hasPrice ? formatCurrencyBRL(asset.price) : "Preço indisponível"}
        </Text>
      </View>

      <Text style={styles.type}>
        Tipo: {asset.assetClass === "STOCK" ? "Ação" : "ETF"} | {asset.category}
      </Text>

      <View style={styles.row}>
        <Text style={styles.label}>Status:</Text>
        <Text style={[styles.status, styles[`status_${analysis.status}`]]}>{analysis.status}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.meta}>
          P/VP: {typeof asset.pvp === "number" ? formatDecimalBR(asset.pvp, 2) : "indisponível"}
        </Text>
        <Text style={styles.meta}>
          DY (12m):{" "}
          {typeof asset.dividendYield12m === "number"
            ? `${formatDecimalBR(asset.dividendYield12m, 1)}%`
            : "indisponível"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.meta}>
          P/L: {typeof asset.pl === "number" ? formatDecimalBR(asset.pl, 1) : "indisponível"}
        </Text>
        <Text style={styles.meta}>Atualizado: {formatUpdatedAt(asset.priceUpdatedAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  tickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ticker: { fontSize: 18, fontWeight: "700" },
  price: { fontSize: 16, fontWeight: "600" },
  type: { fontSize: 12, color: "#666", marginBottom: 6 },
  label: { fontSize: 14, color: "#444" },
  status: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 12, color: "#555" },
  favoriteBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0a7a0a",
    borderWidth: 1,
    borderColor: "#0a7a0a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  status_ATRATIVO: { color: "#0a7a0a" },
  status_JUSTO: { color: "#a36a00" },
  status_ESTICADO: { color: "#b00020" },
  status_INDEFINIDO: { color: "#666" },
});
