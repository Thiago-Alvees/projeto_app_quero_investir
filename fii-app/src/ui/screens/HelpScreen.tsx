import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Help">;

type HelpItem = {
  id: string;
  question: string;
  answer: string;
};

const HELP_ITEMS: HelpItem[] = [
  {
    id: "purpose",
    question: "Qual e o objetivo do aplicativo?",
    answer:
      "O aplicativo existe para ajudar iniciantes a entender melhor os investimentos antes de tomar a propria decisao. Ele organiza dados, mostra indicadores e traduz termos tecnicos em linguagem simples.",
  },
  {
    id: "what-we-do",
    question: "O que o app faz na pratica?",
    answer:
      "Mostra FIIs, acoes e ETFs com filtros, comparador, simulacoes de carteira, agenda de dividendos, score didatico e explicacoes sobre indicadores como P/VP, P/L e DY.",
  },
  {
    id: "what-we-dont-do",
    question: "O que o app nao faz?",
    answer:
      "O app nao recomenda compra ou venda, nao promete retorno, nao substitui assessoria financeira e nao decide no lugar do usuario. O papel dele e educar, organizar e explicar.",
  },
  {
    id: "valuation",
    question: "Como funciona a classificacao de preco dos FIIs?",
    answer:
      "Hoje a classificacao educativa usa P/VP. A regra principal e: abaixo de 0,95 tende a atrativo; entre 0,95 e 1,10 tende a justo; acima de 1,10 tende a esticado. O usuario continua responsavel pela decisao final.",
  },
  {
    id: "login",
    question: "Quando o login e necessario?",
    answer:
      "O login e necessario para criar, editar e sincronizar carteiras na nuvem. Para explorar mercado, cursos e entender o app, o usuario pode navegar sem conta.",
  },
  {
    id: "public-private",
    question: "Como funcionam carteiras publicas e privadas?",
    answer:
      "Carteiras privadas servem para uso pessoal. Carteiras publicas podem ser compartilhadas com amigos por codigo e exibidas no app como referencia educativa.",
  },
  {
    id: "calendar",
    question: "Como funciona a agenda de dividendos?",
    answer:
      "A agenda mostra eventos futuros com estimativas educativas baseadas nos dados disponiveis. Ela ajuda o usuario a se organizar, mas nao substitui a confirmacao oficial do ativo.",
  },
  {
    id: "sources",
    question: "De onde vem os dados do aplicativo?",
    answer:
      "O app combina fontes de mercado utilizadas no projeto com fallback local quando necessario. Isso melhora continuidade de uso, mas o usuario deve sempre validar informacoes importantes antes de investir.",
  },
  {
    id: "courses",
    question: "Por que existe uma aba de cursos?",
    answer:
      "Porque o objetivo do produto e apoiar autonomia. Em vez de empurrar uma decisao pronta, o app aponta cursos gratuitos e confiaveis para o usuario aprender com a B3.",
  },
];

export default function HelpScreen({ navigation }: Props) {
  const [openId, setOpenId] = useState<string | null>(HELP_ITEMS[0]?.id ?? null);

  function toggleItem(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>Ajuda do App</Text>
          <Text style={styles.subtitle}>
            Esta tela explica como o app funciona, o que ele entrega e quais limites
            existem no produto.
          </Text>
        </View>

        <View style={styles.missionCard}>
          <Text style={styles.sectionTitle}>Resumo rapido</Text>
          <Text style={styles.missionLine}>
            O app ajuda a analisar e entender investimentos.
          </Text>
          <Text style={styles.missionLine}>
            O app nao toma decisoes pelo usuario.
          </Text>
          <Text style={styles.missionLine}>
            O foco e clareza, educacao financeira e apoio a autonomia.
          </Text>
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            style={styles.ctaButton}
            onPress={() => navigation.navigate("MainTabs", { screen: "MarketTab" })}
          >
            <Text style={styles.ctaButtonText}>Ir para Mercado</Text>
          </Pressable>
          <Pressable
            style={styles.ctaButton}
            onPress={() => navigation.navigate("MainTabs", { screen: "CoursesTab" })}
          >
            <Text style={styles.ctaButtonText}>Ver Cursos</Text>
          </Pressable>
        </View>

        <View style={styles.policyCard}>
          <Text style={styles.sectionTitle}>Documentos do app</Text>
          <Text style={styles.policyText}>
            Consulte os termos de uso, a base de privacidade e o aviso legal para
            entender com clareza como o produto funciona.
          </Text>
          <Pressable
            style={styles.policyButton}
            onPress={() => navigation.navigate("Policies")}
          >
            <Text style={styles.policyButtonText}>Abrir termos e privacidade</Text>
          </Pressable>
        </View>

        <View style={styles.faqCard}>
          <Text style={styles.sectionTitle}>Perguntas frequentes</Text>
          {HELP_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <View key={item.id} style={styles.faqItem}>
                <Pressable
                  onPress={() => toggleItem(item.id)}
                  style={styles.faqHeader}
                >
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  <Text style={styles.faqToggle}>{isOpen ? "-" : "+"}</Text>
                </Pressable>
                {isOpen ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.disclaimerCard}>
          <Text style={styles.sectionTitle}>Importante</Text>
          <Text style={styles.disclaimerText}>
            O aplicativo tem finalidade educativa e informativa. Antes de investir,
            confirme dados relevantes e avalie seu perfil, objetivos e prazo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef3f8" },
  container: { padding: 16, gap: 12, paddingBottom: 30 },
  heroCard: {
    borderRadius: 18,
    backgroundColor: "#0f172a",
    padding: 16,
    gap: 8,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 13, lineHeight: 19, color: "#cbd5e1" },
  missionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    backgroundColor: "#fff",
    padding: 14,
    gap: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  missionLine: { fontSize: 13, color: "#334155" },
  ctaRow: {
    flexDirection: "row",
    gap: 10,
  },
  ctaButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#111827",
    paddingVertical: 11,
    alignItems: "center",
  },
  ctaButtonText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  policyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    backgroundColor: "#fff",
    padding: 14,
    gap: 10,
  },
  policyText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
  },
  policyButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  policyButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  faqCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    backgroundColor: "#fff",
    padding: 14,
    gap: 8,
  },
  faqItem: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  faqToggle: {
    width: 20,
    textAlign: "center",
    fontSize: 18,
    color: "#0f172a",
  },
  faqAnswer: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 19,
    color: "#475569",
  },
  disclaimerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff7f7",
    padding: 14,
    gap: 8,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#7f1d1d",
  },
});
