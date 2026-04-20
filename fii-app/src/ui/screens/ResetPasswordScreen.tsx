import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import AuthLayout from "../components/AuthLayout";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { updateSupabasePassword } from "../../data/services/supabase/client";
import { getPasswordValidationMessage } from "../utils/authValidation";

type Props = NativeStackScreenProps<RootStackParamList, "ResetPassword">;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(route.params?.message ?? null);
  const [success, setSuccess] = useState(false);

  async function handleUpdatePassword() {
    const passwordMessage = getPasswordValidationMessage(password);
    if (passwordMessage) {
      setMessage(passwordMessage);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("A confirmacao de senha precisa ser igual a senha informada.");
      return;
    }

    setWorking(true);
    const result = await updateSupabasePassword(password);
    setMessage(result.message ?? (result.ok ? "Senha atualizada." : "Falha ao atualizar senha."));
    if (result.ok) {
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    }
    setWorking(false);
  }

  return (
    <AuthLayout
      title="Nova senha"
      subtitle="Defina uma nova senha para concluir a recuperacao da conta."
    >
      {route.params?.invalidLink ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Link invalido ou expirado</Text>
          <Text style={styles.warningText}>
            Solicite um novo e-mail de recuperacao para receber outro link.
          </Text>
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Nova senha"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!success}
      />
      <TextInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirme a nova senha"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!success}
      />
      <Text style={styles.passwordHint}>Use pelo menos 8 caracteres.</Text>

      {!success ? (
        <Pressable
          style={styles.primaryBtn}
          onPress={handleUpdatePassword}
          disabled={working || route.params?.invalidLink}
        >
          <Text style={styles.primaryBtnText}>Salvar nova senha</Text>
        </Pressable>
      ) : (
        <Pressable
          style={styles.primaryBtn}
          onPress={() => navigation.navigate("MainTabs", { screen: "AccountTab" })}
        >
          <Text style={styles.primaryBtnText}>Ir para conta</Text>
        </Pressable>
      )}

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
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#f8fafc",
  },
  passwordHint: { fontSize: 11, lineHeight: 16, color: "#64748b", marginTop: -4 },
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
