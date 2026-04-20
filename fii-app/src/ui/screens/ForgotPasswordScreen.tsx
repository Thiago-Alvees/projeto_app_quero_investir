import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import AuthLayout from "../components/AuthLayout";
import type { RootStackParamList } from "../navigation/AppNavigator";
import {
  getPasswordResetRedirectUrl,
  isSupabaseConfigured,
  requestPasswordReset,
} from "../../data/services/supabase/client";
import { isValidEmail } from "../utils/authValidation";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const configured = isSupabaseConfigured();
  const redirectUrl = getPasswordResetRedirectUrl();
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRecoverPassword() {
    if (!isValidEmail(email)) {
      setMessage("Digite um e-mail valido para recuperar a senha.");
      return;
    }

    setWorking(true);
    const result = await requestPasswordReset(email);
    setMessage(
      result.message ?? (result.ok ? "Link enviado com sucesso." : "Falha ao enviar link.")
    );
    setWorking(false);
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Informe o e-mail da conta que deve receber o link para redefinir a senha."
    >
      {!configured ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Supabase nao configurado</Text>
          <Text style={styles.warningText}>
            Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` no `.env`.
          </Text>
        </View>
      ) : null}

      {__DEV__ ? (
        <View style={styles.debugCard}>
          <Text style={styles.debugTitle}>URL de retorno atual</Text>
          <Text style={styles.debugText}>{redirectUrl}</Text>
          <Text style={styles.debugHint}>
            Adicione essa URL em `Authentication` → `URL Configuration` → `Redirect URLs`.
          </Text>
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="E-mail para recuperar a senha"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable
        style={styles.primaryBtn}
        onPress={handleRecoverPassword}
        disabled={working || !configured}
      >
        <Text style={styles.primaryBtnText}>Enviar link de redefinicao</Text>
      </Pressable>

      <View style={styles.linkGroup}>
        <Pressable
          style={styles.linkBtn}
          onPress={() => navigation.navigate("Login")}
          disabled={working}
        >
          <Text style={styles.linkText}>Voltar para login</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.feedback}>{message}</Text> : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  warningCard: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 12,
    backgroundColor: "#fffbeb",
    padding: 12,
    gap: 6,
  },
  warningTitle: { fontSize: 14, fontWeight: "700", color: "#92400e" },
  warningText: { fontSize: 12, lineHeight: 18, color: "#92400e" },
  debugCard: {
    borderWidth: 1,
    borderColor: "#dbe2ea",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 6,
  },
  debugTitle: { fontSize: 13, fontWeight: "700", color: "#111827" },
  debugText: { fontSize: 12, lineHeight: 18, color: "#1d4ed8" },
  debugHint: { fontSize: 11, lineHeight: 16, color: "#64748b" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#f8fafc",
  },
  primaryBtn: {
    borderRadius: 12,
    backgroundColor: "#111827",
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  linkGroup: { alignItems: "center" },
  linkBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  linkText: { fontSize: 12, color: "#1d4ed8", fontWeight: "700" },
  feedback: { fontSize: 12, color: "#334155" },
});
