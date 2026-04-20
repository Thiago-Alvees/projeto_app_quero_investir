import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { CURRENT_POLICY_VERSION } from "../../static/policyVersions";
export { CURRENT_POLICY_VERSION } from "../../static/policyVersions";

type ExtraKey = "SUPABASE_URL" | "SUPABASE_ANON_KEY";
type PolicyAcceptanceSource =
  | "EMAIL_SIGNUP"
  | "GOOGLE_SIGNUP"
  | "PROFILE_CONFIRMATION";

type PolicyAuditContext = {
  ipAddress?: string | null;
  deviceLabel?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  executionEnv?: string | null;
};

function getExtraValue(key: ExtraKey): string | null {
  const extra =
    (Constants.expoConfig?.extra as { [k: string]: string | undefined } | undefined) ?? {};

  const manifestExtra = (
    Constants as { manifest?: { extra?: { [k: string]: string | undefined } } }
  ).manifest?.extra;

  const value = extra[key] ?? manifestExtra?.[key] ?? "";
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

const supabaseUrl = getExtraValue("SUPABASE_URL");
const supabaseAnonKey = getExtraValue("SUPABASE_ANON_KEY");

const supabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage as unknown as Storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

WebBrowser.maybeCompleteAuthSession();

let resolvedUserId: string | null = null;
let resolveUserIdPromise: Promise<string | null> | null = null;

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    const user = toUserSnapshot(session?.user ?? null);
    resolvedUserId = user && !user.isAnonymous && user.email ? user.id : null;
  });
}

export type SupabaseUserSnapshot = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  authProvider: "anonymous" | "email" | "google" | null;
  fullName: string | null;
  avatarUrl: string | null;
  policyVersion: string | null;
  policyAcceptedAt: string | null;
};

type AuthActionResult = {
  ok: boolean;
  message?: string;
  user?: SupabaseUserSnapshot | null;
};

type OAuthProvider = "google";
type SupabaseAuthProvider = "anonymous" | "email" | OAuthProvider;
type RecoveryLinkResult = {
  ok: boolean;
  isRecoveryLink: boolean;
  message?: string;
};

const PASSWORD_RESET_PATH = "auth/reset-password";
const RECENT_SENSITIVE_AUTH_WINDOW_MS = 5 * 60 * 1000;

let lastSensitiveActionAuthUserId: string | null = null;
let lastSensitiveActionAuthAt: number | null = null;
let lastSensitiveActionAccessToken: string | null = null;

function resolveAuthProvider(user: {
  is_anonymous?: boolean;
  app_metadata?: unknown;
}): SupabaseAuthProvider | null {
  const appMetadata = (user.app_metadata as { provider?: string } | undefined) ?? {};
  if (user.is_anonymous) return "anonymous";
  if (appMetadata.provider === "google") return "google";
  return "email";
}

function markSensitiveActionAuth(
  userId: string | null | undefined,
  accessToken?: string | null
): void {
  if (!userId) return;
  lastSensitiveActionAuthUserId = userId;
  lastSensitiveActionAuthAt = Date.now();
  lastSensitiveActionAccessToken = String(accessToken ?? "").trim() || null;
}

function clearSensitiveActionAuth(): void {
  lastSensitiveActionAuthUserId = null;
  lastSensitiveActionAuthAt = null;
  lastSensitiveActionAccessToken = null;
}

function toUserSnapshot(
  user:
    | { id: string; email?: string | null; is_anonymous?: boolean; app_metadata?: unknown }
    | null
    | undefined
): SupabaseUserSnapshot | null {
  if (!user) return null;
  const appMetadata =
    (user.app_metadata as { provider?: string } | undefined) ?? {};
  const userMetadata =
    (user as {
      user_metadata?: {
        full_name?: string;
        avatar_url?: string;
        policy_version?: string;
        terms_accepted_at?: string;
      };
    }).user_metadata ?? {};

  return {
    id: user.id,
    email: user.email ?? null,
    isAnonymous: Boolean(user.is_anonymous ?? appMetadata.provider === "anonymous"),
    authProvider: resolveAuthProvider(user),
    fullName: userMetadata.full_name ?? null,
    avatarUrl: userMetadata.avatar_url ?? null,
    policyVersion: userMetadata.policy_version ?? null,
    policyAcceptedAt: userMetadata.terms_accepted_at ?? null,
  };
}

async function upsertPolicyAcceptanceRow(input: {
  userId: string;
  policyVersion: string;
  acceptedAt: string;
  source: PolicyAcceptanceSource;
  audit?: PolicyAuditContext;
}): Promise<void> {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.from("user_policy_acceptances").upsert(
    {
      user_id: input.userId,
      policy_version: input.policyVersion,
      accepted_at: input.acceptedAt,
      acceptance_source: input.source,
      ip_address: input.audit?.ipAddress ?? null,
      device_label: input.audit?.deviceLabel ?? null,
      platform: input.audit?.platform ?? null,
      app_version: input.audit?.appVersion ?? null,
      execution_env: input.audit?.executionEnv ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error && __DEV__) {
    console.log("[supabase] policy acceptance upsert failed:", error.message);
  }
}

async function updatePolicyAcceptanceMetadata(input: {
  policyVersion: string;
  acceptedAt: string;
}): Promise<void> {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.updateUser({
    data: {
      policy_version: input.policyVersion,
      terms_accepted_at: input.acceptedAt,
    },
  });

  if (error && __DEV__) {
    console.log("[supabase] policy acceptance metadata update failed:", error.message);
  }
}

async function syncPolicyAcceptanceFromMetadata(
  user:
    | {
        id: string;
        user_metadata?: { policy_version?: string; terms_accepted_at?: string } | null;
      }
    | null
    | undefined
): Promise<void> {
  if (!user?.id) return;

  const policyVersion = String(user.user_metadata?.policy_version ?? "").trim();
  const acceptedAt = String(user.user_metadata?.terms_accepted_at ?? "").trim();

  if (!policyVersion || !acceptedAt) return;

  await upsertPolicyAcceptanceRow({
    userId: user.id,
    policyVersion,
    acceptedAt,
    source: "PROFILE_CONFIRMATION",
  });
}

function buildPolicyAuditContext(): PolicyAuditContext {
  const appVersion =
    String(Constants.expoConfig?.version ?? Constants.expoConfig?.runtimeVersion ?? "").trim() ||
    "dev";
  const platformVersion = String(Platform.Version ?? "").trim();
  const executionEnv = String(Constants.executionEnvironment ?? "").trim() || null;

  return {
    deviceLabel: `${Platform.OS}${platformVersion ? ` ${platformVersion}` : ""}`,
    platform: Platform.OS,
    appVersion,
    executionEnv,
  };
}

async function tryRegisterPolicyAcceptanceViaEdgeFunction(input: {
  policyVersion: string;
  acceptedAt: string;
  source: PolicyAcceptanceSource;
  audit: PolicyAuditContext;
}): Promise<{ ok: boolean; ipAddress?: string | null }> {
  if (!supabaseClient) return { ok: false };

  const { data, error } = await supabaseClient.functions.invoke("register-policy-acceptance", {
    body: {
      policyVersion: input.policyVersion,
      acceptedAt: input.acceptedAt,
      source: input.source,
      audit: input.audit,
    },
  });

  if (error) {
    if (__DEV__) {
      console.log("[supabase] policy acceptance edge function fallback:", error.message);
    }
    return { ok: false };
  }

  const payload =
    (data as { ok?: boolean; ipAddress?: string | null } | null | undefined) ?? {};

  return {
    ok: Boolean(payload.ok),
    ipAddress: payload.ipAddress ?? null,
  };
}

export async function persistCurrentUserPolicyAcceptance(input?: {
  acceptedAt?: string;
  policyVersion?: string;
  source?: PolicyAcceptanceSource;
}): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) return { ok: false, message: error.message };

  const user = data.session?.user ?? null;
  if (!user) {
    return { ok: false, message: "Sessão não encontrada para registrar aceite." };
  }

  const acceptedAt = input?.acceptedAt ?? new Date().toISOString();
  const policyVersion = input?.policyVersion ?? CURRENT_POLICY_VERSION;
  const source = input?.source ?? "PROFILE_CONFIRMATION";
  const audit = buildPolicyAuditContext();
  const functionResult = await tryRegisterPolicyAcceptanceViaEdgeFunction({
    policyVersion,
    acceptedAt,
    source,
    audit,
  });

  await Promise.all([
    functionResult.ok
      ? Promise.resolve()
      : upsertPolicyAcceptanceRow({
          userId: user.id,
          policyVersion,
          acceptedAt,
          source,
          audit,
        }),
    updatePolicyAcceptanceMetadata({
      policyVersion,
      acceptedAt,
    }),
  ]);

  const { data: refreshedData } = await supabaseClient.auth.getSession();

  return {
    ok: true,
    message: "Aceite registrado com sucesso.",
    user: toUserSnapshot(refreshedData.session?.user ?? user),
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseClient);
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

export function subscribeToSupabaseAuthChanges(callback: () => void): () => void {
  if (!supabaseClient) {
    return () => undefined;
  }

  const {
    data: { subscription },
  } = supabaseClient.auth.onAuthStateChange(() => {
    callback();
  });

  return () => subscription.unsubscribe();
}

export async function getSupabaseSessionUser(): Promise<SupabaseUserSnapshot | null> {
  if (!supabaseClient) return null;

  const { data } = await supabaseClient.auth.getSession();
  const user = data.session?.user ?? null;
  await syncPolicyAcceptanceFromMetadata(user);
  return toUserSnapshot(user);
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  options?: { recordPolicyAcceptance?: boolean }
): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { ok: false, message: "Informe e-mail e senha." };
  }

  const acceptedAt = options?.recordPolicyAcceptance ? new Date().toISOString() : null;
  const { data, error } = await supabaseClient.auth.signUp({
    email: normalizedEmail,
    password,
    options: acceptedAt
      ? {
          data: {
            policy_version: CURRENT_POLICY_VERSION,
            terms_accepted_at: acceptedAt,
          },
        }
      : undefined,
  });

  if (error) return { ok: false, message: error.message };

  const user = data.user ?? data.session?.user ?? null;
  resolvedUserId = user?.id ?? null;
  if (data.session?.user?.id) {
    markSensitiveActionAuth(data.session.user.id, data.session.access_token);
  }

  if (user && acceptedAt && data.session) {
    await persistCurrentUserPolicyAcceptance({
      acceptedAt,
      policyVersion: CURRENT_POLICY_VERSION,
      source: "EMAIL_SIGNUP",
    });
  }

  return {
    ok: true,
    user: toUserSnapshot(user),
    message: data.session
      ? "Conta criada e autenticada."
      : "Conta criada. Confirme seu e-mail para concluir o acesso.",
  };
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { ok: false, message: "Informe e-mail e senha." };
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    const message = String(error.message ?? "");
    if (message.toLowerCase().includes("email not confirmed")) {
      return {
        ok: false,
        message:
          "Seu e-mail ainda não foi confirmado. Abra o e-mail de confirmação ou toque em 'Reenviar confirmação'.",
      };
    }
    return { ok: false, message };
  }

  const user = data.user ?? data.session?.user ?? null;
  resolvedUserId = user?.id ?? null;
  if (user?.id) {
    markSensitiveActionAuth(user.id, data.session?.access_token ?? null);
  }
  await syncPolicyAcceptanceFromMetadata(user);
  return { ok: true, user: toUserSnapshot(user), message: "Login realizado com sucesso." };
}

function extractAuthorizationCode(callbackUrl: string): string | null {
  try {
    const parsed = new URL(callbackUrl);
    const code = parsed.searchParams.get("code");
    if (code) return code;
  } catch {
    // fallback to regex for environments without URL parsing support
  }

  const codeMatch = callbackUrl.match(/[?&]code=([^&#]+)/i);
  return codeMatch ? decodeURIComponent(codeMatch[1]) : null;
}

function extractParamsFromUrl(rawUrl: string): URLSearchParams {
  const params = new URLSearchParams();

  const queryIndex = rawUrl.indexOf("?");
  if (queryIndex >= 0) {
    const queryString = rawUrl.slice(queryIndex + 1).split("#")[0] ?? "";
    const queryParams = new URLSearchParams(queryString);
    queryParams.forEach((value, key) => {
      params.set(key, value);
    });
  }

  const hashIndex = rawUrl.indexOf("#");
  if (hashIndex >= 0) {
    const hashString = rawUrl.slice(hashIndex + 1);
    const hashParams = new URLSearchParams(hashString);
    hashParams.forEach((value, key) => {
      params.set(key, value);
    });
  }

  return params;
}

export function getPasswordResetRedirectUrl(): string {
  return makeRedirectUri({ path: PASSWORD_RESET_PATH });
}

export async function consumePasswordResetUrl(url: string): Promise<RecoveryLinkResult> {
  if (!supabaseClient) {
    return { ok: false, isRecoveryLink: false, message: "Supabase não configurado." };
  }

  const normalizedUrl = String(url ?? "").trim();
  if (!normalizedUrl) {
    return { ok: false, isRecoveryLink: false, message: "Link de recuperação inválido." };
  }

  const params = extractParamsFromUrl(normalizedUrl);
  const type = String(params.get("type") ?? "").trim().toLowerCase();
  const hasResetPath = normalizedUrl.includes(PASSWORD_RESET_PATH);
  const isRecoveryLink = hasResetPath || type === "recovery";

  if (!isRecoveryLink) {
    return { ok: false, isRecoveryLink: false };
  }

  const accessToken = String(params.get("access_token") ?? "").trim();
  const refreshToken = String(params.get("refresh_token") ?? "").trim();
  const errorDescription = String(
    params.get("error_description") ?? params.get("error") ?? ""
  ).trim();

  if (errorDescription) {
    return {
      ok: false,
      isRecoveryLink: true,
      message: decodeURIComponent(errorDescription),
    };
  }

  if (!accessToken || !refreshToken) {
    return {
      ok: false,
      isRecoveryLink: true,
      message:
        "O link de recuperação não trouxe uma sessão válida. Solicite um novo e-mail de redefinição.",
    };
  }

  const { error } = await supabaseClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    return {
      ok: false,
      isRecoveryLink: true,
      message: error.message,
    };
  }

  return {
    ok: true,
    isRecoveryLink: true,
    message: "Sessão de recuperação pronta. Defina sua nova senha.",
  };
}

export async function signInWithOAuthProvider(
  provider: OAuthProvider,
  options?: { recordPolicyAcceptance?: boolean }
): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const redirectTo = makeRedirectUri({ path: "auth/callback" });

  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    const lowerMessage = error.message.toLowerCase();
    if (lowerMessage.includes("redirect") || lowerMessage.includes("uri")) {
      return {
        ok: false,
        message: `Redirect URI não liberado no Supabase. Adicione: ${redirectTo}`,
      };
    }
    return { ok: false, message: error.message };
  }

  if (!data?.url) {
    return { ok: false, message: "Não foi possível iniciar o login social." };
  }

  const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (authResult.type !== "success") {
    return { ok: false, message: "Login social cancelado." };
  }

  const code = extractAuthorizationCode(authResult.url);
  if (!code) {
    return { ok: false, message: "Código de autenticação não retornado." };
  }

  const { data: sessionData, error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(
    code
  );

  if (exchangeError) {
    return { ok: false, message: exchangeError.message };
  }

  const user = sessionData.user ?? null;
  resolvedUserId = user?.id ?? null;
  if (user?.id) {
    markSensitiveActionAuth(user.id, sessionData.session?.access_token ?? null);
  }

  if (options?.recordPolicyAcceptance) {
    const acceptanceResult = await persistCurrentUserPolicyAcceptance({
      source: "GOOGLE_SIGNUP",
    });

    if (!acceptanceResult.ok) {
      return acceptanceResult;
    }

    return {
      ok: true,
      user: acceptanceResult.user ?? toUserSnapshot(user),
      message: "Login social concluído com sucesso.",
    };
  }

  await syncPolicyAcceptanceFromMetadata(user);

  return {
    ok: true,
    user: toUserSnapshot(user),
    message: "Login social concluído com sucesso.",
  };
}

export async function signOutSupabase(): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const { error } = await supabaseClient.auth.signOut();
  if (error) return { ok: false, message: error.message };

  resolvedUserId = null;
  clearSensitiveActionAuth();
  return { ok: true, message: "Sessão encerrada.", user: null };
}

export function hasRecentSensitiveActionReauth(
  userId: string | null | undefined,
  maxAgeMs = RECENT_SENSITIVE_AUTH_WINDOW_MS
): boolean {
  if (!userId || !lastSensitiveActionAuthAt || !lastSensitiveActionAuthUserId) {
    return false;
  }

  if (lastSensitiveActionAuthUserId !== userId) {
    return false;
  }

  return Date.now() - lastSensitiveActionAuthAt <= maxAgeMs;
}

export function getSensitiveActionReauthWindowMinutes(): number {
  return Math.round(RECENT_SENSITIVE_AUTH_WINDOW_MS / 60000);
}

export async function reauthenticateCurrentSupabaseUser(input?: {
  password?: string;
}): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) return { ok: false, message: error.message };

  const currentUser = data.session?.user ?? null;
  if (!currentUser) {
    return { ok: false, message: "Sessão não encontrada. Faça login novamente." };
  }

  const provider = resolveAuthProvider(currentUser);
  if (provider === "anonymous") {
    return {
      ok: false,
      message: "A conta precisa estar autenticada para confirmar a exclusão.",
    };
  }

  if (provider === "google") {
    const result = await signInWithOAuthProvider("google");
    return result.ok
      ? {
          ok: true,
          user: result.user,
          message: "Identidade confirmada com Google.",
        }
      : result;
  }

  const normalizedPassword = String(input?.password ?? "").trim();
  if (!currentUser.email) {
    return { ok: false, message: "E-mail da conta não encontrado para confirmar a identidade." };
  }

  if (!normalizedPassword) {
    return { ok: false, message: "Digite sua senha atual para continuar." };
  }

  const reauth = await supabaseClient.auth.signInWithPassword({
    email: currentUser.email,
    password: normalizedPassword,
  });

  if (reauth.error) {
    return { ok: false, message: "Senha atual incorreta ou sessão expirada." };
  }

  const reauthUser = reauth.data.user ?? reauth.data.session?.user ?? null;
  if (!reauthUser || reauthUser.id !== currentUser.id) {
    return {
      ok: false,
      message: "Não foi possível confirmar a mesma conta. Tente novamente.",
    };
  }

  resolvedUserId = reauthUser.id;
  markSensitiveActionAuth(reauthUser.id, reauth.data.session?.access_token ?? null);
  await syncPolicyAcceptanceFromMetadata(reauthUser);

  return {
    ok: true,
    user: toUserSnapshot(reauthUser),
    message: "Identidade confirmada com sucesso.",
  };
}

export async function requestPasswordReset(email: string): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, message: "Informe um e-mail válido." };
  }

  const redirectTo = getPasswordResetRedirectUrl();
  const { error } = await supabaseClient.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });
  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message:
      "E-mail de recuperação enviado. Abra o link no mesmo dispositivo para redefinir a senha no app.",
  };
}

export async function updateSupabasePassword(password: string): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const normalizedPassword = password.trim();
  if (!normalizedPassword) {
    return { ok: false, message: "Informe a nova senha." };
  }

  const { data, error } = await supabaseClient.auth.updateUser({
    password: normalizedPassword,
  });

  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message: "Senha atualizada com sucesso.",
    user: toUserSnapshot(data.user ?? null),
  };
}

export async function resendSignUpConfirmation(email: string): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, message: "Informe um e-mail válido." };
  }

  const emailRedirectTo = makeRedirectUri({ path: "auth/callback" });
  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email: normalizedEmail,
    options: {
      emailRedirectTo,
    },
  });

  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message: "E-mail de confirmação reenviado. Verifique caixa de entrada e spam.",
  };
}

export async function updateSupabaseProfile(input: {
  fullName?: string;
  avatarUrl?: string;
}): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const avatarUrl = typeof input.avatarUrl === "string" ? input.avatarUrl.trim() : "";

  const { data, error } = await supabaseClient.auth.updateUser({
    data: {
      full_name: fullName || null,
      avatar_url: avatarUrl || null,
    },
  });

  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message: "Perfil atualizado com sucesso.",
    user: toUserSnapshot(data.user ?? null),
  };
}

export async function deleteSupabaseAccount(): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const { data, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) return { ok: false, message: sessionError.message };

  const currentUser = data.session?.user ?? null;
  const accessToken =
    lastSensitiveActionAuthUserId === currentUser?.id &&
    hasRecentSensitiveActionReauth(currentUser?.id ?? null)
      ? String(lastSensitiveActionAccessToken ?? "").trim() || data.session?.access_token || ""
      : data.session?.access_token || "";
  if (!currentUser) {
    return { ok: false, message: "Sessão não encontrada. Faça login novamente." };
  }

  if (!hasRecentSensitiveActionReauth(currentUser.id)) {
    return {
      ok: false,
      message: "Confirme sua identidade novamente antes de excluir a conta.",
    };
  }

  const functionUrl = `${supabaseUrl}/functions/v1/delete-account`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey ?? "",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ confirm: true }),
  }).catch((error) => {
    return {
      ok: false,
      status: 0,
      json: async () => ({ error: String(error) }),
    } as Response;
  });

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "");
    let errorMessage = "";
    try {
      const payload = JSON.parse(rawBody) as { error?: string; message?: string };
      errorMessage = String(payload.error ?? payload.message ?? "").trim();
    } catch {
      errorMessage = String(rawBody ?? "").trim();
    }

    if (response.status === 403) {
      return {
        ok: false,
        message: "Confirme sua identidade novamente antes de excluir a conta.",
      };
    }

    if (response.status === 404) {
      return {
        ok: false,
        message:
          "Função delete-account não encontrada. Faça o deploy da Edge Function no Supabase.",
      };
    }

    return {
      ok: false,
      message: errorMessage || `Falha ao excluir conta (status ${response.status}).`,
    };
  }

  await supabaseClient.auth.signOut().catch(() => undefined);
  resolvedUserId = null;
  clearSensitiveActionAuth();

  return {
    ok: true,
    message: "Conta excluída definitivamente.",
    user: null,
  };
}

export async function ensureSupabaseUserId(): Promise<string | null> {
  if (!supabaseClient) return null;
  if (resolvedUserId) return resolvedUserId;
  if (resolveUserIdPromise) return resolveUserIdPromise;

  resolveUserIdPromise = (async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const sessionUser = toUserSnapshot(sessionData.session?.user ?? null);
    if (sessionUser && !sessionUser.isAnonymous && sessionUser.email) {
      resolvedUserId = sessionUser.id;
      return sessionUser.id;
    }

    resolvedUserId = null;
    return null;
  })()
    .catch((error) => {
      if (__DEV__) {
        console.log("[supabase] failed to resolve authenticated user id:", String(error));
      }
      return null;
    })
    .finally(() => {
      resolveUserIdPromise = null;
    });

  return resolveUserIdPromise;
}
