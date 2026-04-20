import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CURRENT_POLICY_EFFECTIVE_DATE,
  POLICY_RELEASES,
} from "../../data/static/policyVersions";

type PolicySection = {
  id: string;
  title: string;
  content: string[];
};

const POLICY_SECTIONS: PolicySection[] = [
  {
    id: "terms",
    title: "Termos de uso",
    content: [
      "Este aplicativo tem finalidade educativa e informativa. Ele organiza dados de mercado, apresenta indicadores e oferece simulacoes para apoiar a analise do usuario.",
      "O app nao realiza recomendacao personalizada de compra, venda ou manutencao de ativos. Nenhuma tela deve ser interpretada como consultoria, assessoria, promessa de retorno ou garantia de resultado.",
      "O usuario continua integralmente responsavel por validar informacoes relevantes, avaliar seu perfil de risco e decidir se vai ou nao investir.",
      "Algumas funcoes exigem conta, como salvar carteiras, sincronizar dados entre dispositivos e compartilhar carteiras publicas. O uso do app sem login continua disponivel para exploracao de mercado, agenda, cursos e conteudo educativo.",
      "Ao criar uma carteira publica, o usuario autoriza a exibicao dessa carteira no app por meio do codigo de compartilhamento. O usuario e responsavel pelas informacoes que decidir tornar publicas.",
      "O aplicativo pode evoluir, ajustar regras de analise, alterar fluxos e atualizar funcionalidades sem aviso previo. O uso continuado apos alteracoes representa concordancia com a versao vigente destes termos.",
      "Se o usuario nao concordar com estes termos, deve interromper o uso do aplicativo.",
    ],
  },
  {
    id: "privacy",
    title: "Privacidade",
    content: [
      "Quando o usuario cria conta ou faz login, podemos tratar dados necessarios para autenticacao e uso da plataforma, como e-mail, identificador da conta, nome de exibicao, avatar e carteiras salvas.",
      "Tambem podemos armazenar preferencias ligadas ao funcionamento do app, como onboarding, favoritos, alertas, lembretes locais e configuracoes de uso, conforme os recursos habilitados pelo usuario.",
      "Carteiras marcadas como privadas ficam restritas ao proprio usuario autenticado. Carteiras marcadas como publicas podem ser exibidas no app e acessadas por compartilhamento.",
      "As notificacoes locais so sao ativadas com permissao do usuario. Elas servem para lembretes e organizacao pessoal dentro do aplicativo.",
      "O app pode utilizar provedores terceiros para autenticacao, armazenamento e integracoes tecnicas necessarias ao funcionamento da conta. Esses provedores tratam dados conforme suas proprias politicas.",
      "O aplicativo nao tem como objetivo vender dados pessoais. O tratamento de dados ocorre para operar as funcoes oferecidas ao usuario.",
      "O usuario pode atualizar seu perfil, excluir seus dados locais vinculados ao app ou solicitar a exclusao definitiva da conta pelos recursos ja disponiveis na area de conta.",
    ],
  },
  {
    id: "legal",
    title: "Aviso legal",
    content: [
      "As analises exibidas pelo app usam regras objetivas e simplificadas para fins educativos. Exemplo: na classificacao de FIIs, o P/VP e usado como criterio principal para indicar se o preco parece atrativo, justo ou esticado.",
      "Essas classificacoes sao apenas apoio de leitura. Elas nao substituem estudo proprio, leitura de relatorios, consulta a documentos oficiais ou avaliacao profissional.",
      "Dados de mercado podem sofrer atraso, indisponibilidade, divergencia, arredondamento ou mudanca de fonte. Antes de investir, o usuario deve confirmar informacoes em fontes oficiais e atualizadas.",
      "Rentabilidade passada nao garante rentabilidade futura. Simulacoes, comparativos e estimativas de dividendos existem para facilitar entendimento e nao para prever resultado real.",
      "Links externos, incluindo cursos da B3, sao fornecidos como referencia educativa. O conteudo dessas paginas e de responsabilidade dos respectivos provedores.",
      "Este texto e uma base operacional criada a partir do funcionamento atual do app. Antes de publicar comercialmente, o ideal e revisar estes documentos com apoio juridico especializado.",
    ],
  },
];

export default function PoliciesScreen() {
  const [openId, setOpenId] = useState<string | null>(POLICY_SECTIONS[0]?.id ?? null);

  function toggleSection(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>Termos, privacidade e aviso legal</Text>
          <Text style={styles.subtitle}>
            Documento base do aplicativo para explicar uso, dados tratados e limites
            da analise entregue ao usuario.
          </Text>
          <Text style={styles.effectiveDate}>
            Versao base em vigor: {CURRENT_POLICY_EFFECTIVE_DATE}
          </Text>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Importante</Text>
          <Text style={styles.noticeText}>
            Este conteudo foi criado com base no estado atual do produto. Ele ja ajuda
            na transparencia do app, mas deve passar por revisao juridica antes de um
            lancamento comercial maior.
          </Text>
        </View>

        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Historico de versoes</Text>
          {POLICY_RELEASES.map((release) => (
            <View key={release.version} style={styles.historyItem}>
              <Text style={styles.historyLabel}>
                {release.label} - {release.effectiveDate}
              </Text>
              <Text style={styles.historyVersion}>Versao tecnica: {release.version}</Text>
              <Text style={styles.historySummary}>{release.summary}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionList}>
          {POLICY_SECTIONS.map((section) => {
            const isOpen = openId === section.id;

            return (
              <View key={section.id} style={styles.sectionCard}>
                <Pressable
                  onPress={() => toggleSection(section.id)}
                  style={styles.sectionHeader}
                >
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionToggle}>{isOpen ? "-" : "+"}</Text>
                </Pressable>

                {isOpen ? (
                  <View style={styles.sectionContent}>
                    {section.content.map((paragraph) => (
                      <Text key={paragraph} style={styles.paragraph}>
                        {`\u2022 ${paragraph}`}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
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
  title: { fontSize: 24, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 13, lineHeight: 19, color: "#cbd5e1" },
  effectiveDate: { fontSize: 12, fontWeight: "700", color: "#93c5fd" },
  noticeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    padding: 14,
    gap: 8,
  },
  noticeTitle: { fontSize: 15, fontWeight: "800", color: "#92400e" },
  noticeText: { fontSize: 12, lineHeight: 18, color: "#92400e" },
  historyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    backgroundColor: "#fff",
    padding: 14,
    gap: 10,
  },
  historyTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  historyItem: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
    gap: 4,
  },
  historyLabel: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  historyVersion: { fontSize: 12, fontWeight: "700", color: "#1d4ed8" },
  historySummary: { fontSize: 12, lineHeight: 18, color: "#475569" },
  sectionList: { gap: 10 },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    backgroundColor: "#fff",
    padding: 14,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  sectionToggle: {
    width: 20,
    textAlign: "center",
    fontSize: 18,
    color: "#0f172a",
  },
  sectionContent: { gap: 10 },
  paragraph: {
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
  },
});
