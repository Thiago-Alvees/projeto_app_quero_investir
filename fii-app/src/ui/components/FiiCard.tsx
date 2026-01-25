import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import type { Fii } from "../../domain/models/fii";
import { getValuationStatus } from "../../domain/rules/valuation";
import { useNavigation } from "@react-navigation/native";
import { computePvp } from "../../domain/rules/pvp";

type Props = {
  fii: Fii;
  updatedAt?: string | null; // <- NOVO
};

export default function FiiCard({ fii, updatedAt }: Props) {
  const navigation = useNavigation<any>();

  const pvp = computePvp(fii);
  const status = getValuationStatus(pvp);

  return (
    <Pressable
      onPress={() => navigation.navigate("FiiDetail", { fii, updatedAt })}
      style={styles.card}
    >
      <View style={styles.row}>
        <Text style={styles.ticker}>{fii.ticker}</Text>
        <Text style={styles.price}>R$ {fii.price.toFixed(2).replace(".", ",")}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Status:</Text>
        <Text style={[styles.status, styles[`status_${status}`]]}>{status}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.meta}>P/VP: {pvp.toFixed(2).replace(".", ",")}</Text>
        <Text style={styles.meta}>DY (12m): {fii.dividendYield12m.toFixed(1).replace(".", ",")}%</Text>
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
  ticker: { fontSize: 18, fontWeight: "700" },
  price: { fontSize: 16, fontWeight: "600" },
  label: { fontSize: 14, color: "#444" },
  status: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 13, color: "#555" },

  status_ATRATIVO: { color: "#0a7a0a" },
  status_JUSTO: { color: "#a36a00" },
  status_ESTICADO: { color: "#b00020" },
});
