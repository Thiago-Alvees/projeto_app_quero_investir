import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useRoute } from "@react-navigation/native";

import { useEventsFeed } from "../hooks/useEventsFeed";

function formatDate(value: string | null | undefined): string {
  if (!value) return "data indisponível";
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return "data indisponível";
  return new Date(ms).toLocaleString("pt-BR");
}

export default function EventsFeedScreen() {
  const route = useRoute<any>();
  const { items, loading, error, updatedAt, provider, refresh } = useEventsFeed();
  const [query, setQuery] = useState(String(route?.params?.query ?? ""));

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return items;
    return items.filter((item) => {
      if (item.ticker.toUpperCase().includes(q)) return true;
      if (String(item.companyName ?? "").toUpperCase().includes(q)) return true;
      if (String(item.subject ?? "").toUpperCase().includes(q)) return true;
      return false;
    });
  }, [items, query]);

  async function openUrl(url: string) {
    const safe = String(url ?? "").trim();
    if (!safe) return;
    await WebBrowser.openBrowserAsync(safe);
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Eventos oficiais</Text>
            <Text style={styles.subtitle}>
              Fatos relevantes, comunicados e avisos publicados em fonte oficial.
            </Text>
            <Text style={styles.meta}>
              Fonte: {provider ?? "indisponível"}
              {updatedAt ? ` | Atualizado: ${formatDate(updatedAt)}` : ""}
            </Text>
          </View>
          <Pressable onPress={refresh} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>Atualizar</Text>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por ticker, empresa ou assunto"
          placeholderTextColor="#6b7280"
          style={styles.search}
          autoCapitalize="characters"
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.centerText}>Carregando eventos...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Não foi possível carregar agora.</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>Nenhum evento encontrado.</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => openUrl(item.url)}>
                <View style={styles.cardRow}>
                  <Text style={styles.ticker}>{item.ticker}</Text>
                  <Text style={styles.date}>
                    {formatDate(item.deliveredAt ?? item.referenceDate)}
                  </Text>
                </View>
                <Text style={styles.category}>
                  {item.category}
                  {item.type ? ` • ${item.type}` : ""}
                </Text>
                <Text style={styles.subject} numberOfLines={3}>
                  {item.subject || "Sem assunto"}
                </Text>
                {item.companyName ? (
                  <Text style={styles.company} numberOfLines={1}>
                    {item.companyName}
                  </Text>
                ) : null}
                <Text style={styles.linkHint}>Toque para abrir o documento.</Text>
              </Pressable>
            )}
          />
        )}

        <Text style={styles.disclaimer}>
          Conteúdo educativo. O app não recomenda compra ou venda. Leia o documento oficial e avalie
          o contexto antes de tomar decisão.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f7fb" },
  container: { flex: 1, paddingHorizontal: 16, paddingBottom: 14 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  headerInfo: { flex: 1, paddingRight: 10 },
  title: { fontSize: 22, fontWeight: "900", color: "#0f172a" },
  subtitle: { marginTop: 4, color: "#475569", fontSize: 13, lineHeight: 18 },
  meta: { marginTop: 6, color: "#64748b", fontSize: 12 },
  refreshBtn: {
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  refreshText: { fontWeight: "800", color: "#0f172a", fontSize: 12 },
  search: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
  },
  center: { paddingTop: 26, alignItems: "center" },
  centerText: { marginTop: 8, color: "#475569", fontWeight: "700" },
  errorTitle: { color: "#b91c1c", fontWeight: "900", fontSize: 14 },
  errorText: { marginTop: 6, color: "#7f1d1d", textAlign: "center" },
  list: { paddingTop: 14, paddingBottom: 8 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  ticker: { fontWeight: "900", color: "#0f172a", fontSize: 13 },
  date: { color: "#64748b", fontWeight: "700", fontSize: 12 },
  category: { marginTop: 6, color: "#0f172a", fontWeight: "800", fontSize: 12 },
  subject: { marginTop: 6, color: "#334155", fontSize: 13, lineHeight: 18 },
  company: { marginTop: 6, color: "#64748b", fontSize: 12 },
  linkHint: { marginTop: 8, color: "#0f172a", fontWeight: "800", fontSize: 12 },
  disclaimer: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
});
