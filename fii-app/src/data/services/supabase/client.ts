import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ExtraKey = "SUPABASE_URL" | "SUPABASE_ANON_KEY";

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

let resolvedUserId: string | null = null;
let resolveUserIdPromise: Promise<string | null> | null = null;

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    resolvedUserId = session?.user?.id ?? null;
  });
}

export type SupabaseUserSnapshot = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  fullName: string | null;
  avatarUrl: string | null;
};

type AuthActionResult = {
  ok: boolean;
  message?: string;
  user?: SupabaseUserSnapshot | null;
};

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
      user_metadata?: { full_name?: string; avatar_url?: string };
    }).user_metadata ?? {};

  return {
    id: user.id,
    email: user.email ?? null,
    isAnonymous: Boolean(user.is_anonymous ?? appMetadata.provider === "anonymous"),
    fullName: userMetadata.full_name ?? null,
    avatarUrl: userMetadata.avatar_url ?? null,
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseClient);
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

export async function getSupabaseSessionUser(): Promise<SupabaseUserSnapshot | null> {
  if (!supabaseClient) return null;

  const { data } = await supabaseClient.auth.getSession();
  return toUserSnapshot(data.session?.user ?? null);
}

export async function signUpWithEmailPassword(
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

  const { data, error } = await supabaseClient.auth.signUp({
    email: normalizedEmail,
    password,
  });

  if (error) return { ok: false, message: error.message };

  const user = data.user ?? data.session?.user ?? null;
  resolvedUserId = user?.id ?? null;

  return {
    ok: true,
    user: toUserSnapshot(user),
    message: data.session
      ? "Conta criada e autenticada."
      : "Conta criada. Verifique o e-mail para confirmar, se necessário.",
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

  if (error) return { ok: false, message: error.message };

  const user = data.user ?? data.session?.user ?? null;
  resolvedUserId = user?.id ?? null;
  return { ok: true, user: toUserSnapshot(user), message: "Login realizado com sucesso." };
}

export async function signOutSupabase(): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const { error } = await supabaseClient.auth.signOut();
  if (error) return { ok: false, message: error.message };

  resolvedUserId = null;
  return { ok: true, message: "Sessão encerrada.", user: null };
}

export async function requestPasswordReset(email: string): Promise<AuthActionResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase não configurado." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, message: "Informe um e-mail válido." };
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(normalizedEmail);
  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message: "E-mail de recuperação enviado. Confira sua caixa de entrada.",
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

  const { error } = await supabaseClient.functions.invoke("delete-account", {
    body: { confirm: true },
  });

  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("404")) {
      return {
        ok: false,
        message:
          "Função delete-account não encontrada. Faça o deploy da Edge Function no Supabase.",
      };
    }
    return { ok: false, message: message || "Falha ao excluir conta." };
  }

  await supabaseClient.auth.signOut().catch(() => undefined);
  resolvedUserId = null;

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
    const currentUserId = sessionData.session?.user?.id ?? null;
    if (currentUserId) {
      resolvedUserId = currentUserId;
      return currentUserId;
    }

    const { data, error } = await supabaseClient.auth.signInAnonymously();
    if (error) throw error;

    const signedUserId = data.user?.id ?? data.session?.user?.id ?? null;
    resolvedUserId = signedUserId;
    return signedUserId;
  })()
    .catch((error) => {
      if (__DEV__) {
        console.log("[supabase] anonymous auth failed:", String(error));
      }
      return null;
    })
    .finally(() => {
      resolveUserIdPromise = null;
    });

  return resolveUserIdPromise;
}
