import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";

import { B3_INVESTMENT_COURSES } from "../../data/static/b3Courses";

type CourseCategory =
  | "TODOS"
  | "Primeiros Passos"
  | "Renda Fixa"
  | "Renda Variável"
  | "Planejamento";
type OrderMode = "TRILHA" | "ALFABETICO";

const CATEGORY_OPTIONS: Array<{ id: CourseCategory; label: string }> = [
  { id: "TODOS", label: "Todos" },
  { id: "Primeiros Passos", label: "Primeiros passos" },
  { id: "Renda Fixa", label: "Renda fixa" },
  { id: "Renda Variável", label: "Renda variável" },
  { id: "Planejamento", label: "Planejamento" },
];

export default function CoursesScreen() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CourseCategory>("TODOS");
  const [orderMode, setOrderMode] = useState<OrderMode>("TRILHA");

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = B3_INVESTMENT_COURSES.filter((course) => {
      const categoryMatch = category === "TODOS" || course.category === category;
      if (!categoryMatch) return false;
      if (!normalized) return true;
      return (
        course.title.toLowerCase().includes(normalized) ||
        course.summary.toLowerCase().includes(normalized)
      );
    });

    return [...filtered].sort((a, b) => {
      if (orderMode === "TRILHA") return a.trackStep - b.trackStep;
      return a.title.localeCompare(b.title, "pt-BR");
    });
  }, [query, category, orderMode]);

  async function handleOpenCourse(url: string) {
    try {
      const result = await WebBrowser.openBrowserAsync(url);
      if (result.type !== "opened") {
        await WebBrowser.openBrowserAsync("https://edu.b3.com.br/");
      }
    } catch {
      Alert.alert(
        "Link indisponível",
        "Não foi possível abrir este curso agora. Tente novamente em alguns minutos."
      );
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.title}>Cursos</Text>
          <Text style={styles.subtitle}>
            Trilha recomendada com cursos oficiais da B3 para iniciantes em investimentos.
          </Text>
          <Text style={styles.subtitle}>
            Objetivo: apoiar a tomada de decisão com educação, não decidir pelo usuário.
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            Fonte: B3 Educação • cursos gratuitos e foco prático
          </Text>
          <Text style={styles.metaText}>Cursos: {filteredCourses.length}</Text>
        </View>

        <View style={styles.orderRow}>
          <Pressable
            style={[styles.orderChip, orderMode === "TRILHA" && styles.orderChipActive]}
            onPress={() => setOrderMode("TRILHA")}
          >
            <Text
              style={[
                styles.orderChipText,
                orderMode === "TRILHA" && styles.orderChipTextActive,
              ]}
            >
              Ordem recomendada
            </Text>
          </Pressable>
          <Pressable
            style={[styles.orderChip, orderMode === "ALFABETICO" && styles.orderChipActive]}
            onPress={() => setOrderMode("ALFABETICO")}
          >
            <Text
              style={[
                styles.orderChipText,
                orderMode === "ALFABETICO" && styles.orderChipTextActive,
              ]}
            >
              A-Z
            </Text>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar curso por tema"
          style={styles.input}
        />

        <View style={styles.chipRow}>
          {CATEGORY_OPTIONS.map((option) => {
            const active = category === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategory(option.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={filteredCourses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Nenhum curso encontrado com este filtro.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.levelBadge}>{item.level}</Text>
              </View>
              <Text style={styles.trackBadge}>
                Etapa {item.trackStep}: {item.trackStage}
              </Text>
              <Text style={styles.cardCategory}>{item.category}</Text>
              <Text style={styles.cardSummary}>{item.summary}</Text>
              <Pressable
                onPress={() => handleOpenCourse(item.url)}
                style={styles.openBtn}
              >
                <Text style={styles.openBtnText}>Abrir curso da B3</Text>
              </Pressable>
            </View>
          )}
        />

        <Text style={styles.disclaimer}>
          Conteúdo externo da B3. Este app organiza e resume os cursos para facilitar sua trilha.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef3f8" },
  container: { flex: 1, padding: 16 },
  hero: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#0f172a",
    gap: 6,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 12, color: "#bfdbfe" },
  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  metaText: { fontSize: 11, color: "#475569" },
  orderRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  orderChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  orderChipActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  orderChipText: { fontSize: 12, color: "#334155", fontWeight: "700" },
  orderChipTextActive: { color: "#fff" },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  chipRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  chipText: { fontSize: 12, color: "#334155", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  list: { marginTop: 12, paddingBottom: 12 },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a", flex: 1 },
  levelBadge: {
    fontSize: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#0f172a",
    color: "#0f172a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  trackBadge: {
    fontSize: 11,
    color: "#1e3a8a",
    fontWeight: "700",
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  cardCategory: { fontSize: 12, color: "#475569", fontWeight: "700" },
  cardSummary: { fontSize: 12, color: "#334155" },
  openBtn: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: "#0f172a",
    alignItems: "center",
    paddingVertical: 9,
  },
  openBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 14,
    alignItems: "center",
  },
  emptyText: { fontSize: 12, color: "#64748b" },
  disclaimer: { fontSize: 11, color: "#64748b" },
});
