import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { FiiHistoryPoint } from "../../data/services/fiiService";

type Props = {
  data: FiiHistoryPoint[];
};

function formatBRL(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export default function HistorySparkline({ data }: Props) {
  if (!data.length) return null;

  const ordered = [...data].sort((a, b) => a.date - b.date);
  const closes = ordered.map((item) => item.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chart}
      >
        {ordered.map((item) => {
          const normalized = (item.close - min) / range;
          const barHeight = 8 + normalized * 52;
          return <View key={`bar-${item.date}`} style={[styles.bar, { height: barHeight }]} />;
        })}
      </ScrollView>

      <View style={styles.legend}>
        <Text style={styles.legendText}>Min R$ {formatBRL(min)}</Text>
        <Text style={styles.legendText}>Max R$ {formatBRL(max)}</Text>
        <Text style={styles.legendText}>
          Último R$ {formatBRL(ordered[ordered.length - 1]?.close ?? 0)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  chart: { alignItems: "flex-end", gap: 2, paddingVertical: 8 },
  bar: {
    width: 3,
    backgroundColor: "#111",
    borderRadius: 2,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  legendText: { fontSize: 11, color: "#666" },
});
