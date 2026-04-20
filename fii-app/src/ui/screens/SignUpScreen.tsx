import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import AuthLayout from "../components/AuthLayout";
import type { RootStackParamList } from "../navigation/AppNavigator";
import {
  isSupabaseConfigured,
  signInWithOAuthProvider,
  signUpWithEmailPassword,
} from "../../data/services/supabase/client";
import {
  getPasswordValidationMessage,
  isValidEmail,
} from "../utils/authValidation";

type Props = NativeStackScreenProps<RootStackParamList, "SignUp">;

export default function SignUpScreen({ navigation }: Props) {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleEmailSignUp() {
    if (!acceptedTerms) {
      setMessage("Para criar conta, aceite os termos, privacidade e aviso legal.");
      return;
    }

    if (!isValidEmail(email)) {
      setMessage("Informe um e-mail valido para criar a conta.");
      return;
    }

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
    const result = await signUpWithEmailPassword(email, password, {
      recordPolicyAcceptance: true,
    });
    setMessage(result.message ?? (result.ok ? "Conta criada." : "Falha ao criar conta."));
    if (result.ok) {
      setPassword("");
      setConfirmPassword("");
      if (result.message?.toLowerCase().includes("confirme seu e-mail")) {
        navigation.navigate("Login");
      } else {
        navigation.navigate("MainTabs", { screen: "AccountTab" });
      }
    }
    setWorking(false);
  }

  async function handleGoogleSignUp() {
    if (!acceptedTerms) {
      setMessage("Para criar conta, aceite os termos, privacidade e aviso legal.");
      return;
    }

    setWorking(true);
    const result = await signInWithOAuthProvider("google", {
      recordPolicyAcceptance: true,
    });
    setMessage(
      result.message ?? (result.ok ? "Conta criada com Google." : "Falha na criacao.")
    );
    if (result.ok) {
      navigation.navigate("MainTabs", { screen: "AccountTab" });
    }
    setWorking(false);
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Crie sua conta para sincronizar carteiras, salvar favoritos e compartilhar analises com mais controle."
    >
      {!configured ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Supabase nao configurado</Text>
          <Text style={styles.warningText}>
            Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` no `.env`.
          </Text>
        </View>
      ) : null}

      <View style={styles.legalCard}>
        <Text style={styles.legalText}>
          Antes de criar a conta, revise os documentos do aplicativo.
        </Text>
        <Pressable
          style={styles.linkBtn}
          onPress={() => navigation.navigate("Policies")}
          disabled={working}
        >
          <Text style={styles.linkText}>Abrir termos, privacidade e aviso legal</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.checkboxRow}
        onPress={() => setAcceptedTerms((current) => !current)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acceptedTerms }}
      >
        <Ionicons
          name={acceptedTerms ? "checkbox" : "square-outline"}
          size={20}
          color={acceptedTerms ? "#111827" : "#64748b"}
        />
        <Text style={styles.checkboxText}>
          Li e concordo com os termos de uso, privacidade e aviso legal.
        </Text>
      </Pressable>

      <View style={styles.socialList}>
        <Pressable
          style={[styles.socialBtn, !acceptedTerms ? styles.buttonDisabled : null]}
          onPress={handleGoogleSignUp}
          disabled={working || !configured || !acceptedTerms}
        >
          <Ionicons name="logo-google" size={16} color="#111" />
          <Text style={styles.socialBtnText}>Criar conta com Google</Text>
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
      <TextInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirme sua senha"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.passwordHint}>Use pelo menos 8 caracteres.</Text>

      <Pressable
        style={[styles.primaryBtn, !acceptedTerms ? styles.buttonDisabled : null]}
        onPress={handleEmailSignUp}
        disabled={working || !configured || !acceptedTerms}
      >
        <Text style={styles.primaryBtnText}>Criar conta com e-mail</Text>
      </Pressable>

      <View style={styles.linkGroup}>
        <Pressable
          style={styles.linkBtn}
          onPress={() => navigation.navigate("Login")}
          disabled={working}
        >
          <Text style={styles.linkText}>Ja tem conta? Entrar</Text>
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
  legalCard: {
    borderWidth: 1,
    borderColor: "#dbe2ea",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: "#f8fafc",
  },
  legalText: { fontSize: 12, lineHeight: 18, color: "#475569" },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
  },
  checkboxText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#334155",
  },
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
  buttonDisabled: { opacity: 0.45 },
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
  passwordHint: { fontSize: 11, lineHeight: 16, color: "#64748b", marginTop: -4 },
  primaryBtn: {
    borderRadius: 12,
    backgroundColor: "#111827",
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  linkGroup: { alignItems: "center", gap: 2 },
  linkBtn: { alignSelf: "flex-start", paddingVertical: 4 },
  linkText: { fontSize: 12, color: "#1d4ed8", fontWeight: "700" },
  feedback: { fontSize: 12, color: "#334155" },
});
