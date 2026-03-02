import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import type { Fii } from "../../domain/models/fii";
import { computePvp } from "../../domain/rules/pvp";
import { getValuationStatus } from "../../domain/rules/valuation";
import { formatCurrencyBRL, formatDecimalBR } from "../utils/format";

type Props = {
  fii: Fii;
  updatedAt: string | null;
  fundamentalsUpdatedAt: string | null;
  isFavorite: boolean;
};

export default function FiiCard({
  fii,
  updatedAt,
  fundamentalsUpdatedAt,
  isFavorite,
}: Props) {
  const navigation = useNavigation<any>();
  const pvp = computePvp(fii);
  const status = getValuationStatus(pvp);
  const hasPrice = Number.isFinite(fii.price) && fii.price > 0;

  const dyLabel =
    fii.dyStatus === "APURACAO" || !Number.isFinite(fii.dividendYield12m)
      ? "em apuração"
      : `${formatDecimalBR(fii.dividendYield12m, 1)}%`;

  return (
    <Pressable
      onPress={() => navigation.navigate("FiiDetail", { fii, updatedAt, fundamentalsUpdatedAt })}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={styles.tickerRow}>
          <Text style={styles.ticker}>{fii.ticker}</Text>
          {isFavorite ? <Text style={styles.favoriteBadge}>FAV</Text> : null}
        </View>
        <Text style={styles.price}>
          {hasPrice ? formatCurrencyBRL(fii.price) : "Preço indisponível"}
        </Text>
      </View>

      <Text style={styles.type}>Tipo: {fii.type}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Status:</Text>
        <Text style={[styles.status, styles[`status_${status}`]]}>{status}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.meta}>
          P/VP: {Number.isFinite(pvp) ? formatDecimalBR(pvp, 2) : "indisponível"}
        </Text>
        <Text style={styles.meta}>DY (12m): {dyLabel}</Text>
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
  },
  tickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ticker: { fontSize: 18, fontWeight: "700" },
  price: { fontSize: 16, fontWeight: "600" },
  type: { fontSize: 12, color: "#666", marginBottom: 6 },
  label: { fontSize: 14, color: "#444" },
  status: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 13, color: "#555" },
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
