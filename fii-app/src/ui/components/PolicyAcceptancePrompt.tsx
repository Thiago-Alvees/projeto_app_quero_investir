import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  busy: boolean;
  version: string;
  onReview: () => void;
  onAccept: () => void;
  onDismiss: () => void;
};

export default function PolicyAcceptancePrompt({
  visible,
  busy,
  version,
  onReview,
  onAccept,
  onDismiss,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Atualizacao importante</Text>
          <Text style={styles.title}>Nova versao dos termos</Text>
          <Text style={styles.body}>
            Sua conta precisa revisar e aceitar a versao {version} dos termos,
            privacidade e aviso legal.
          </Text>

          <View style={styles.actions}>
            <Pressable style={styles.secondaryBtn} onPress={onReview} disabled={busy}>
              <Text style={styles.secondaryBtnText}>Revisar termos</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={onAccept} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Aceitar agora</Text>
              )}
            </Pressable>
          </View>

          <Pressable style={styles.laterBtn} onPress={onDismiss} disabled={busy}>
            <Text style={styles.laterBtnText}>Lembrar depois</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 18,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#b45309",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    color: "#475569",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryBtn: {
    flex: 1,
    minWidth: 130,
    borderRadius: 12,
    backgroundColor: "#111827",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 130,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  laterBtn: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  laterBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
});
