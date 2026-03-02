import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  deleteSupabaseAccount,
  getSupabaseSessionUser,
  isSupabaseConfigured,
  requestPasswordReset,
  signInWithEmailPassword,
  signOutSupabase,
  signUpWithEmailPassword,
  updateSupabaseProfile,
  type SupabaseUserSnapshot,
} from "../../data/services/supabase/client";
import { deleteAllPortfoliosForCurrentUser } from "../../data/services/portfolioService";

function maskUserId(value: string): string {
  if (value.length < 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function AccountScreen() {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [user, setUser] = useState<SupabaseUserSnapshot | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const isLoggedWithAccount = Boolean(user && !user.isAnonymous && user.email);

  const refreshSession = useCallback(async () => {
    if (!configured) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const currentUser = await getSupabaseSessionUser();
    setUser(currentUser);
    setEmail((prev) => (prev.trim() ? prev : currentUser?.email ?? ""));
    setFullName(currentUser?.fullName ?? "");
    setAvatarUrl(currentUser?.avatarUrl ?? "");
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const userTypeLabel = useMemo(() => {
    if (!user) return "Sem sessão ativa";
    return user.isAnonymous ? "Sessão anônima" : "Conta autenticada";
  }, [user]);

  async function handleSignIn() {
    setWorking(true);
    const result = await signInWithEmailPassword(email, password);
    setMessage(result.message ?? (result.ok ? "Login concluído." : "Falha no login."));
    if (result.ok) {
      setPassword("");
      await refreshSession();
    }
    setWorking(false);
  }

  async function handleSignUp() {
    setWorking(true);
    const result = await signUpWithEmailPassword(email, password);
    setMessage(result.message ?? (result.ok ? "Conta criada." : "Falha ao criar conta."));
    if (result.ok) {
      setPassword("");
      await refreshSession();
    }
    setWorking(false);
  }

  async function handleSignOut() {
    setWorking(true);
    const result = await signOutSupabase();
    setMessage(result.message ?? (result.ok ? "Sessão encerrada." : "Falha ao encerrar sessão."));
    if (result.ok) {
      await refreshSession();
    }
    setWorking(false);
  }

  async function handlePasswordRecovery() {
    const targetEmail = user?.email ?? email.trim();
    setWorking(true);
    const result = await requestPasswordReset(targetEmail);
    setMessage(result.message ?? (result.ok ? "E-mail enviado." : "Falha ao enviar e-mail."));
    setWorking(false);
  }

  async function handleProfileUpdate() {
    setWorking(true);
    const result = await updateSupabaseProfile({ fullName, avatarUrl });
    setMessage(result.message ?? (result.ok ? "Perfil atualizado." : "Falha ao atualizar perfil."));
    if (result.ok) {
      await refreshSession();
    }
    setWorking(false);
  }

  function handleDeleteDataAndSignOut() {
    Alert.alert(
      "Excluir meus dados",
      "Isso remove suas carteiras da conta atual e encerra a sessão neste dispositivo. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            await deleteAllPortfoliosForCurrentUser();
            const signOut = await signOutSupabase();
            setMessage(
              signOut.ok
                ? "Dados removidos e sessão encerrada."
                : "Dados removidos, mas não foi possível encerrar a sessão."
            );
            await refreshSession();
            setWorking(false);
          },
        },
      ]
    );
  }

  function handleDeleteAccountPermanently() {
    Alert.alert(
      "Excluir conta definitivamente",
      "Essa ação remove sua conta de autenticação e todos os dados vinculados. Não é possível desfazer. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir conta",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            const result = await deleteSupabaseAccount();
            setMessage(
              result.message ??
                (result.ok
                  ? "Conta excluída definitivamente."
                  : "Falha ao excluir conta.")
            );
            await refreshSession();
            setWorking(false);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Conta</Text>
        <Text style={styles.subtitle}>
          Gerencie sua conta para sincronizar carteiras entre dispositivos.
        </Text>

        {!configured ? (
          <View style={styles.cardWarning}>
            <Text style={styles.warningTitle}>Supabase não configurado</Text>
            <Text style={styles.warningText}>
              Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` no `.env`.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator />
            <Text style={styles.helper}>Carregando sessão...</Text>
          </View>
        ) : null}

        {!loading && configured && !isLoggedWithAccount ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Acesse sua conta</Text>
            <Text style={styles.helper}>
              Entre com e-mail e senha ou crie uma conta para liberar perfil e gerenciamento.
            </Text>
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
            <View style={styles.actionsRow}>
              <Pressable
                style={styles.primaryBtn}
                onPress={handleSignIn}
                disabled={working || !configured}
              >
                <Text style={styles.primaryBtnText}>Entrar</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={handleSignUp}
                disabled={working || !configured}
              >
                <Text style={styles.primaryBtnText}>Criar conta</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!loading && configured && isLoggedWithAccount ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Status da sessão</Text>
              <Text style={styles.helper}>Tipo: {userTypeLabel}</Text>
              {user?.email ? <Text style={styles.helper}>E-mail: {user.email}</Text> : null}
              {user?.id ? <Text style={styles.helper}>Usuário: {maskUserId(user.id)}</Text> : null}
              <View style={styles.actionsRow}>
                <Pressable style={styles.secondaryBtn} onPress={refreshSession} disabled={working}>
                  <Text style={styles.secondaryBtnText}>Atualizar</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={handleSignOut} disabled={working}>
                  <Text style={styles.secondaryBtnText}>Sair</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Perfil</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nome para exibição"
                autoCapitalize="words"
              />
              <TextInput
                style={styles.input}
                value={avatarUrl}
                onChangeText={setAvatarUrl}
                placeholder="URL da foto (opcional)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={styles.primaryBtn}
                onPress={handleProfileUpdate}
                disabled={working || !configured}
              >
                <Text style={styles.primaryBtnText}>Salvar perfil</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Segurança</Text>
              <Text style={styles.helper}>
                Envie um e-mail para redefinir a senha da sua conta.
              </Text>
              <Pressable
                style={styles.secondaryWideBtn}
                onPress={handlePasswordRecovery}
                disabled={working || !configured}
              >
                <Text style={styles.secondaryWideBtnText}>Recuperar senha por e-mail</Text>
              </Pressable>
            </View>

            <View style={styles.cardDanger}>
              <Text style={styles.cardTitle}>Gerenciamento de dados</Text>
              <Text style={styles.helper}>
                Remove carteiras da conta atual neste app e encerra a sessão.
              </Text>
              <Pressable
                style={styles.dangerBtn}
                onPress={handleDeleteDataAndSignOut}
                disabled={working || !configured}
              >
                <Text style={styles.dangerBtnText}>Excluir meus dados e sair</Text>
              </Pressable>
              <Pressable
                style={styles.dangerBtnFilled}
                onPress={handleDeleteAccountPermanently}
                disabled={working || !configured}
              >
                <Text style={styles.dangerBtnFilledText}>Excluir conta definitivamente</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {message ? <Text style={styles.feedback}>{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f6f6" },
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 13, color: "#555" },
  card: {
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    gap: 8,
  },
  cardDanger: {
    borderWidth: 1,
    borderColor: "#f2c4cc",
    borderRadius: 12,
    backgroundColor: "#fff6f7",
    padding: 12,
    gap: 8,
  },
  cardWarning: {
    borderWidth: 1,
    borderColor: "#d48a00",
    borderRadius: 12,
    backgroundColor: "#fff4de",
    padding: 12,
    gap: 8,
  },
  warningTitle: { fontSize: 14, fontWeight: "700", color: "#7c4b00" },
  warningText: { fontSize: 12, color: "#7c4b00" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111" },
  helper: { fontSize: 12, color: "#555" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  primaryBtn: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111",
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#111",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: "#111", fontWeight: "700", fontSize: 12 },
  secondaryWideBtn: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  secondaryWideBtnText: { color: "#111", fontWeight: "700", fontSize: 12 },
  dangerBtn: {
    borderWidth: 1,
    borderColor: "#b00020",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  dangerBtnText: { color: "#b00020", fontWeight: "700" },
  dangerBtnFilled: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#b00020",
  },
  dangerBtnFilledText: { color: "#fff", fontWeight: "700" },
  feedback: { fontSize: 12, color: "#333" },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
