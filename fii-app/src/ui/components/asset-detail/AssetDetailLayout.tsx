import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { assetDetailStyles as styles } from "./styles";

export type DetailScoreCard = {
  score: number;
  label: string;
  reasons: string[];
};

type Props = {
  ticker: string;
  isFavorite: boolean;
  favoriteLoading?: boolean;
  onToggleFavorite: () => void;
  priceLabel: string;
  metaLines?: string[];
  statusLabel: string;
  message: string;
  scoreCard: DetailScoreCard | null;
  children?: React.ReactNode;
};

export default function AssetDetailLayout({
  ticker,
  isFavorite,
  favoriteLoading = false,
  onToggleFavorite,
  priceLabel,
  metaLines,
  statusLabel,
  message,
  scoreCard,
  children,
}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.ticker}>{ticker}</Text>
        <Pressable onPress={onToggleFavorite} disabled={favoriteLoading} style={styles.starBtn}>
          <Text style={[styles.star, isFavorite && styles.starActive]}>
            {favoriteLoading ? "..." : isFavorite ? "★" : "☆"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.price}>{priceLabel}</Text>

      {metaLines && metaLines.length > 0 ? (
        <View style={styles.metaBox}>
          {metaLines.map((line) => (
            <Text key={line} style={styles.metaLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.status}>{statusLabel}</Text>
      <Text style={styles.message}>{message}</Text>

      {scoreCard ? (
        <View style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>Score didático: {scoreCard.score}/100</Text>
          <Text style={styles.scoreLabel}>{scoreCard.label}</Text>
          {scoreCard.reasons.map((reason) => (
            <Text key={reason} style={styles.scoreReason}>
              • {reason}
            </Text>
          ))}
        </View>
      ) : null}

      {children}
    </ScrollView>
  );
}

