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
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CURRENT_POLICY_VERSION,
  deleteSupabaseAccount,
  getSupabaseSessionUser,
  isSupabaseConfigured,
  persistCurrentUserPolicyAcceptance,
  reauthenticateCurrentSupabaseUser,
  requestPasswordReset,
  signOutSupabase,
  updateSupabaseProfile,
  type SupabaseUserSnapshot,
} from "../../data/services/supabase/client";
import { deleteAllPortfoliosForCurrentUser } from "../../data/services/portfolioService";
import { isValidEmail } from "../utils/authValidation";

function maskUserId(value: string): string {
  if (value.length < 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatAcceptedAt(value: string | null | undefined): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

type SensitiveAction = "delete-data" | "delete-account";

function getSensitiveActionLabel(action: SensitiveAction): string {
  return action === "delete-account" ? "excluir a conta" : "excluir seus dados";
}

export default function AccountScreen() {
  const navigation = useNavigation<any>();
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [user, setUser] = useState<SupabaseUserSnapshot | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSensitiveAction, setPendingSensitiveAction] =
    useState<SensitiveAction | null>(null);
  const [sensitivePassword, setSensitivePassword] = useState("");
  const [sensitiveMessage, setSensitiveMessage] = useState<string | null>(null);

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
    setFullName(currentUser?.fullName ?? "");
    setAvatarUrl(currentUser?.avatarUrl ?? "");
    setRecoveryEmail((prev) => (prev.trim() ? prev : currentUser?.email ?? ""));
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const userTypeLabel = useMemo(() => {
    if (!user) return "Sem sessao ativa";
    return user.isAnonymous ? "Sessao anonima" : "Conta autenticada";
  }, [user]);

  function resetSensitiveActionState() {
    setPendingSensitiveAction(null);
    setSensitivePassword("");
    setSensitiveMessage(null);
  }

  async function handleSignOut() {
    setWorking(true);
    const result = await signOutSupabase();
    setMessage(result.message ?? (result.ok ? "Sessao encerrada." : "Falha ao encerrar sessao."));
    if (result.ok) {
      resetSensitiveActionState();
      setRecoveryEmail("");
      await refreshSession();
    }
    setWorking(false);
  }

  async function handlePasswordRecovery() {
    if (!isValidEmail(recoveryEmail)) {
      setMessage("Digite um e-mail valido para recuperar a senha.");
      return;
    }

    setWorking(true);
    const result = await requestPasswordReset(recoveryEmail);
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

  async function handleAcceptPoliciesAgain() {
    setWorking(true);
    const result = await persistCurrentUserPolicyAcceptance({
      source: "PROFILE_CONFIRMATION",
    });
    setMessage(
      result.message ?? (result.ok ? "Aceite atualizado." : "Falha ao registrar aceite.")
    );
    if (result.ok) {
      await refreshSession();
    }
    setWorking(false);
  }

  function confirmDeleteDataAndSignOut() {
    Alert.alert(
      "Excluir meus dados",
      "Isso remove suas carteiras da conta atual e encerra a sessao neste dispositivo. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            resetSensitiveActionState();
            const deleted = await deleteAllPortfoliosForCurrentUser();
            if (!deleted) {
              setMessage("Falha ao remover os dados da conta.");
              setWorking(false);
              return;
            }

            const signOut = await signOutSupabase();
            setMessage(
              signOut.ok
                ? "Dados removidos e sessao encerrada."
                : "Dados removidos, mas nao foi possivel encerrar a sessao."
            );
            setRecoveryEmail("");
            await refreshSession();
            setWorking(false);
          },
        },
      ]
    );
  }

  function confirmDeleteAccountPermanently() {
    Alert.alert(
      "Excluir conta definitivamente",
      "Essa acao remove sua conta de autenticacao e todos os dados vinculados. Nao e possivel desfazer. Deseja continuar?",
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
                  ? "Conta excluida definitivamente."
                  : "Falha ao excluir conta.")
            );
            resetSensitiveActionState();
            setRecoveryEmail("");
            await refreshSession();
            setWorking(false);
          },
        },
      ]
    );
  }

  function startSensitiveAction(action: SensitiveAction) {
    if (!user?.id) return;

    setMessage(null);
    setSensitiveMessage(null);

    setPendingSensitiveAction(action);
    setSensitivePassword("");
  }

  async function handleSensitiveActionConfirmation() {
    if (!pendingSensitiveAction || !user) return;

    const action = pendingSensitiveAction;
    setWorking(true);
    const result = await reauthenticateCurrentSupabaseUser({
      password: user.authProvider === "email" ? sensitivePassword : undefined,
    });
    setWorking(false);

    if (!result.ok) {
      setSensitiveMessage(
        result.message ?? "Nao foi possivel confirmar sua identidade. Tente novamente."
      );
      return;
    }

    setSensitiveMessage(null);
    setMessage(result.message ?? "Identidade confirmada.");
    if (result.user) {
      setUser(result.user);
    }
    resetSensitiveActionState();

    if (action === "delete-account") {
      confirmDeleteAccountPermanently();
      return;
    }

    confirmDeleteDataAndSignOut();
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>Conta</Text>
          <Text style={styles.subtitle}>
            Gerencie seu acesso, seus dados e as configuracoes da conta em um lugar separado do restante do app.
          </Text>
          <View style={styles.heroActions}>
            <Pressable style={styles.heroButton} onPress={() => navigation.navigate("Help")}>
              <Ionicons name="help-circle-outline" size={16} color="#fff" />
              <Text style={styles.heroButtonText}>Como o app funciona</Text>
            </Pressable>
            <Pressable style={styles.heroButton} onPress={() => navigation.navigate("Policies")}>
              <Ionicons name="document-text-outline" size={16} color="#fff" />
              <Text style={styles.heroButtonText}>Termos e privacidade</Text>
            </Pressable>
          </View>
        </View>

        {!configured ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Supabase nao configurado</Text>
            <Text style={styles.warningText}>
              Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` no `.env`.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator />
            <Text style={styles.helper}>Carregando sessao...</Text>
          </View>
        ) : null}

        {!loading && configured && !isLoggedWithAccount ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Explorar sem conta</Text>
            <Text style={styles.helper}>
              Voce pode navegar pelo mercado, cursos, agenda e ajuda sem login. O acesso fica necessario para salvar carteiras, sincronizar dados e compartilhar analises.
            </Text>

            <View style={styles.guestFeatureList}>
              <Text style={styles.guestFeature}>• Criar e sincronizar carteiras</Text>
              <Text style={styles.guestFeature}>• Compartilhar carteiras publicas</Text>
              <Text style={styles.guestFeature}>• Manter dados da conta organizados</Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => navigation.navigate("Login")}
                disabled={working}
              >
                <Text style={styles.primaryBtnText}>Entrar</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate("SignUp")}
                disabled={working}
              >
                <Text style={styles.secondaryBtnText}>Criar conta</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.linkBtn}
              onPress={() => navigation.navigate("ForgotPassword")}
              disabled={working}
            >
              <Text style={styles.linkBtnText}>Recuperar senha</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && configured && isLoggedWithAccount ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sessao ativa</Text>
              <Text style={styles.helper}>Tipo: {userTypeLabel}</Text>
              {user?.email ? <Text style={styles.helper}>E-mail: {user.email}</Text> : null}
              {user?.id ? <Text style={styles.helper}>Usuario: {maskUserId(user.id)}</Text> : null}
              <Text style={styles.helper}>Versao dos termos: {CURRENT_POLICY_VERSION}</Text>
              <Text style={styles.helper}>
                Versao aceita nesta conta: {user?.policyVersion ?? "nenhuma"}
              </Text>
              {user?.policyAcceptedAt ? (
                <Text style={styles.helper}>
                  Aceite registrado em: {formatAcceptedAt(user.policyAcceptedAt)}
                </Text>
              ) : (
                <Text style={styles.helper}>Aceite ainda nao sincronizado nesta conta.</Text>
              )}
              <View style={styles.actionsRow}>
                <Pressable style={styles.secondaryBtn} onPress={refreshSession} disabled={working}>
                  <Text style={styles.secondaryBtnText}>Atualizar</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={handleAcceptPoliciesAgain}
                  disabled={working || !configured}
                >
                  <Text style={styles.secondaryBtnText}>Registrar aceite</Text>
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
                placeholder="Nome para exibicao"
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
              <Text style={styles.cardTitle}>Seguranca</Text>
              <Text style={styles.helper}>
                Informe o e-mail que deve receber o link para redefinir a senha.
              </Text>
              <TextInput
                style={styles.input}
                value={recoveryEmail}
                onChangeText={setRecoveryEmail}
                placeholder="E-mail para recuperar a senha"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={styles.secondaryWideBtn}
                onPress={handlePasswordRecovery}
                disabled={working || !configured}
              >
                <Text style={styles.secondaryWideBtnText}>Enviar link de redefinicao</Text>
              </Pressable>
            </View>

            <View style={styles.cardDanger}>
              <Text style={styles.cardTitle}>Gerenciamento de dados</Text>
              <Text style={styles.helper}>
                Exclua seus dados locais desta conta ou remova a conta definitivamente do sistema.
              </Text>
              <Text style={styles.helper}>
                Por seguranca, o app sempre pede sua senha atual ou uma nova confirmacao com Google
                antes de concluir a exclusao.
              </Text>
              {pendingSensitiveAction ? (
                <View style={styles.reauthCard}>
                  <Text style={styles.reauthTitle}>Confirme sua identidade</Text>
                  <Text style={styles.helper}>
                    Voce esta prestes a {getSensitiveActionLabel(pendingSensitiveAction)}. Para
                    continuar, confirme sua identidade novamente.
                  </Text>
                  {user?.authProvider === "email" ? (
                    <>
                      <Text style={styles.helper}>
                        Conta atual: {user.email ?? "e-mail nao encontrado"}
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={sensitivePassword}
                        onChangeText={setSensitivePassword}
                        placeholder="Digite sua senha atual"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </>
                  ) : (
                    <Text style={styles.helper}>
                      A confirmacao sera feita com sua conta Google neste dispositivo.
                    </Text>
                  )}
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={styles.secondaryBtn}
                      onPress={resetSensitiveActionState}
                      disabled={working}
                    >
                      <Text style={styles.secondaryBtnText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      style={styles.primaryBtn}
                      onPress={handleSensitiveActionConfirmation}
                      disabled={working}
                    >
                      <Text style={styles.primaryBtnText}>
                        {user?.authProvider === "google"
                          ? "Confirmar com Google"
                          : "Confirmar identidade"}
                      </Text>
                    </Pressable>
                  </View>
                  {sensitiveMessage ? (
                    <Text style={styles.reauthFeedback}>{sensitiveMessage}</Text>
                  ) : null}
                </View>
              ) : null}
              <Pressable
                style={styles.dangerBtn}
                onPress={() => startSensitiveAction("delete-data")}
                disabled={working || !configured}
              >
                <Text style={styles.dangerBtnText}>Excluir meus dados e sair</Text>
              </Pressable>
              <Pressable
                style={styles.dangerBtnFilled}
                onPress={() => startSensitiveAction("delete-account")}
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
  safe: { flex: 1, backgroundColor: "#edf2f7" },
  container: { padding: 16, gap: 12, paddingBottom: 34 },
  heroCard: {
    borderRadius: 16,
    backgroundColor: "#111827",
    padding: 16,
    gap: 8,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 13, color: "#d1d5db", lineHeight: 18 },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  heroButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#1f2937",
  },
  heroButtonText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  warningCard: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 14,
    backgroundColor: "#fffbeb",
    padding: 12,
    gap: 8,
  },
  warningTitle: { fontSize: 14, fontWeight: "700", color: "#92400e" },
  warningText: { fontSize: 12, color: "#92400e" },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 14,
    gap: 10,
  },
  cardDanger: {
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 14,
    backgroundColor: "#fff1f2",
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
  reauthCard: {
    borderWidth: 1,
    borderColor: "#fda4af",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    gap: 10,
  },
  reauthTitle: { fontSize: 14, fontWeight: "700", color: "#7f1d1d" },
  reauthFeedback: { fontSize: 12, lineHeight: 18, color: "#7f1d1d" },
  helper: { fontSize: 12, lineHeight: 18, color: "#475569" },
  guestFeatureList: { gap: 4 },
  guestFeature: { fontSize: 12, color: "#334155" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  primaryBtn: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  secondaryBtn: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  secondaryBtnText: { color: "#111827", fontWeight: "700", fontSize: 13 },
  secondaryWideBtn: {
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  secondaryWideBtnText: { color: "#111827", fontWeight: "700", fontSize: 12 },
  linkBtn: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  linkBtnText: {
    fontSize: 12,
    color: "#1d4ed8",
    fontWeight: "700",
  },
  dangerBtn: {
    borderWidth: 1,
    borderColor: "#b00020",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  dangerBtnText: { color: "#b00020", fontWeight: "700", fontSize: 12 },
  dangerBtnFilled: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#b00020",
  },
  dangerBtnFilledText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  feedback: { fontSize: 12, color: "#334155" },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
