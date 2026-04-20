import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import AuthLayout from "../components/AuthLayout";
import type { RootStackParamList } from "../navigation/AppNavigator";
import {
  isSupabaseConfigured,
  signInWithEmailPassword,
  signInWithOAuthProvider,
} from "../../data/services/supabase/client";
import { isValidEmail } from "../utils/authValidation";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleEmailLogin() {
    if (!isValidEmail(email)) {
      setMessage("Informe um e-mail valido para entrar.");
      return;
    }

    if (!password.trim()) {
      setMessage("Informe sua senha para entrar.");
      return;
    }

    setWorking(true);
    const result = await signInWithEmailPassword(email, password);
    setMessage(result.message ?? (result.ok ? "Login concluido." : "Falha no login."));
    if (result.ok) {
      setPassword("");
      navigation.navigate("MainTabs", { screen: "AccountTab" });
    }
    setWorking(false);
  }

  async function handleGoogleLogin() {
    setWorking(true);
    const result = await signInWithOAuthProvider("google");
    setMessage(
      result.message ?? (result.ok ? "Login social concluido." : "Falha no login social.")
    );
    if (result.ok) {
      navigation.navigate("MainTabs", { screen: "AccountTab" });
    }
    setWorking(false);
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse sua conta para salvar carteiras, sincronizar dados e acompanhar sua evolucao no app."
    >
      {!configured ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Supabase nao configurado</Text>
          <Text style={styles.warningText}>
            Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` no `.env`.
          </Text>
        </View>
      ) : null}

      <View style={styles.socialList}>
        <Pressable
          style={styles.socialBtn}
          onPress={handleGoogleLogin}
          disabled={working || !configured}
        >
          <Ionicons name="logo-google" size={16} color="#111" />
          <Text style={styles.socialBtnText}>Entrar com Google</Text>
        </Pressable>
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>ou por e-mail</Text>
        <View style={styles.divider} />
      </View>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Seu e-mail"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Sua senha"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable
        style={styles.primaryBtn}
        onPress={handleEmailLogin}
        disabled={working || !configured}
      >
        <Text style={styles.primaryBtnText}>Entrar com e-mail</Text>
      </Pressable>

      <View style={styles.linkGroup}>
        <Pressable
          style={styles.linkBtn}
          onPress={() => navigation.navigate("ForgotPassword")}
          disabled={working}
        >
          <Text style={styles.linkText}>Esqueci minha senha</Text>
        </Pressable>
        <Pressable
          style={styles.linkBtn}
          onPress={() => navigation.navigate("SignUp")}
          disabled={working}
        >
          <Text style={styles.linkText}>Nao tem conta? Criar conta</Text>
        </Pressable>
        <Pressable
          style={styles.linkBtn}
          onPress={() => navigation.navigate("Policies")}
          disabled={working}
        >
          <Text style={styles.linkText}>Termos e privacidade</Text>
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
  socialList: { gap: 8 },
  socialBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  socialBtnText: { fontSize: 14, color: "#111", fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: "#e2e8f0" },
  dividerText: { fontSize: 11, color: "#64748b" },
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
  linkGroup: { alignItems: "center", gap: 2 },
  linkBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  linkText: { fontSize: 12, color: "#1d4ed8", fontWeight: "700" },
  feedback: { fontSize: 12, color: "#334155" },
});
