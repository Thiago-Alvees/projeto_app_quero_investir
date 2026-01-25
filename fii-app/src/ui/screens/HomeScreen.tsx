// src/ui/screens/HomeScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
} from "react-native";

import type { Fii } from "../../domain/models/fii";
import FiiCard from "../components/FiiCard";
import type { DataSource } from "../../data/services/fiiService";
import { getFiiList, isOk } from "../../data/services/fiiService";

function formatUpdatedAt(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR");
}

export default function HomeScreen() {
  const [fiis, setFiis] = useState<Fii[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<DataSource>("MOCK");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const result = await getFiiList();

    if (isOk(result)) {
      setFiis(result.data);
      setSource(result.source);
      setUpdatedAt(result.updatedAt ?? null);
    } else {
      setError(result.message);
    }

    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);

      const result = await getFiiList();
      if (!active) return;

      if (isOk(result)) {
        setFiis(result.data);
        setSource(result.source);
        setUpdatedAt(result.updatedAt ?? null);
      } else {
        setError(result.message);
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const updatedAtLabel = formatUpdatedAt(updatedAt);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>FIIs</Text>
            <Text style={styles.subtitle}>Análise simples para iniciantes</Text>
          </View>

          <Pressable onPress={load} style={styles.refreshBtn} disabled={loading}>
            <Text style={styles.refreshText}>{loading ? "..." : "Atualizar"}</Text>
          </Pressable>
        </View>

        {!loading && !error && (
          <View style={[styles.banner, source === "SNAPSHOT" ? styles.bannerSnapshot : styles.bannerMock]}>
            <Text style={styles.bannerText}>
              {source === "SNAPSHOT"
                ? "Dados do dia: snapshot diário (preços consolidados)"
                : "Dados simulados: usando mock (snapshot indisponível)"}
            </Text>
            {updatedAtLabel && (
              <Text style={styles.bannerSubText}>Atualizado em: {updatedAtLabel}</Text>
            )}
          </View>
        )}

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.helper}>Carregando...</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Falha ao carregar</Text>
            <Text style={styles.helper}>{error}</Text>

            <Pressable onPress={load} style={styles.button}>
              <Text style={styles.buttonText}>Tentar novamente</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && (
          <FlatList
            data={fiis}
            keyExtractor={(item) => item.ticker}
            renderItem={({ item }) => <FiiCard fii={item} updatedAt={updatedAt} />}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f6f6" },
  container: { flex: 1, padding: 16 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },

  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 14, color: "#555", marginTop: 4 },

  refreshBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111",
  },
  refreshText: { color: "#fff", fontWeight: "700" },

  banner: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerSnapshot: {
    borderColor: "#0a7a0a",
    backgroundColor: "#eaf7ea",
  },
  bannerMock: {
    borderColor: "#a36a00",
    backgroundColor: "#fff4e5",
  },
  bannerText: { fontSize: 12, color: "#333" },
  bannerSubText: { fontSize: 11, color: "#555", marginTop: 4 },

  list: { paddingTop: 12 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  helper: { fontSize: 13, color: "#555", textAlign: "center" },
  errorTitle: { fontSize: 16, fontWeight: "700" },

  button: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#111",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
