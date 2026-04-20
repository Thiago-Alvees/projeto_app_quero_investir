import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TourStep = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
};

type Props = {
  visible: boolean;
  onFinish: () => void;
};

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    eyebrow: "Quero Investir",
    title: "Seu app ajuda a analisar. A decisão continua sendo sua.",
    description:
      "Aqui você encontra indicadores, comparativos e explicações simples para investir com mais clareza, sem receber ordem de compra ou venda.",
    primaryLabel: "Continuar",
  },
  {
    id: "market",
    eyebrow: "Mercado",
    title: "Compare FIIs, ações e ETFs em poucos toques.",
    description:
      "Use filtros por categoria e DY, veja radar rápido, abra o comparador e entre no detalhe do ativo para entender preço, P/VP, P/L e dividendos.",
    primaryLabel: "Próximo",
  },
  {
    id: "portfolio",
    eyebrow: "Carteiras e Agenda",
    title: "Monte cenários e acompanhe renda.",
    description:
      "Crie carteiras públicas ou privadas, simule aportes, acompanhe agenda de dividendos e ative lembretes para não perder eventos importantes.",
    primaryLabel: "Próximo",
  },
  {
    id: "courses",
    eyebrow: "Cursos e Conta",
    title: "Aprenda com fontes confiáveis enquanto usa o app.",
    description:
      "A aba de cursos reúne trilhas gratuitas da B3. A conta libera sincronização, mas você pode explorar o app antes de se cadastrar.",
    primaryLabel: "Começar",
  },
];

export default function FirstAccessTour({ visible, onFinish }: Props) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      setStepIndex(0);
    }
  }, [visible]);

  const isLastStep = stepIndex === TOUR_STEPS.length - 1;
  const step = useMemo(() => TOUR_STEPS[stepIndex], [stepIndex]);

  function handleNext() {
    if (isLastStep) {
      onFinish();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, TOUR_STEPS.length - 1));
  }

  function handleBack() {
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.backdrop} />
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{step.eyebrow}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          <View style={styles.progressRow}>
            {TOUR_STEPS.map((item, index) => {
              const active = index === stepIndex;
              return (
                <View
                  key={item.id}
                  style={[styles.progressDot, active && styles.progressDotActive]}
                />
              );
            })}
          </View>

          <View style={styles.actionsRow}>
            <Pressable onPress={onFinish} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Pular</Text>
            </Pressable>

            <View style={styles.primaryActions}>
              <Pressable
                onPress={handleBack}
                style={[styles.secondaryButton, stepIndex === 0 && styles.disabledButton]}
                disabled={stepIndex === 0}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    stepIndex === 0 && styles.disabledButtonText,
                  ]}
                >
                  Voltar
                </Text>
              </Pressable>

              <Pressable onPress={handleNext} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{step.primaryLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.72)",
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#0f172a",
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7dd3fc",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#f8fafc",
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: "#cbd5e1",
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#334155",
  },
  progressDotActive: {
    backgroundColor: "#38bdf8",
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  primaryActions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#cbd5e1",
  },
  disabledButton: {
    opacity: 0.45,
  },
  disabledButtonText: {
    color: "#94a3b8",
  },
});
