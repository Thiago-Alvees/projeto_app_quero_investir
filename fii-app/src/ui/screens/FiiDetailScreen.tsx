import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { getValuationMessage, getValuationStatus } from "../../domain/rules/valuation";
import { computePvp } from "../../domain/rules/pvp";

type Props = NativeStackScreenProps<RootStackParamList, "FiiDetail">;

export default function FiiDetailScreen({ route }: Props) {
  const { fii } = route.params;

  const pvp = computePvp(fii);
  const status = getValuationStatus(pvp);
  const message = getValuationMessage(status, fii.dividendYield12m);

  return (
    <View style={styles.container}>
      <Text style={styles.ticker}>{fii.ticker}</Text>
      <Text style={styles.price}>R$ {fii.price.toFixed(2).replace(".", ",")}</Text>

      <Text style={styles.status}>{status}</Text>

      <Text style={styles.message}>{message}</Text>

      <View style={styles.block}>
        <Text>P/VP: {pvp.toFixed(2).replace(".", ",")}</Text>

        {typeof fii.vp === "number" && (
          <Text>VP (cota): R$ {fii.vp.toFixed(2).replace(".", ",")}</Text>
        )}

        <Text>DY (12m): {fii.dividendYield12m.toFixed(1).replace(".", ",")}%</Text>

        {typeof fii.pl === "number" && <Text>P/L: {fii.pl.toFixed(1).replace(".", ",")}</Text>}
      </View>

      <Text style={styles.disclaimer}>
        Esta análise é educacional e não constitui recomendação de investimento.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  ticker: { fontSize: 26, fontWeight: "800" },
  price: { fontSize: 18, marginVertical: 4 },
  status: { fontSize: 16, fontWeight: "700", marginVertical: 8 },
  message: { fontSize: 14, marginBottom: 16 },
  block: { gap: 6 },
  disclaimer: {
    marginTop: 24,
    fontSize: 12,
    color: "#666",
  },
});
