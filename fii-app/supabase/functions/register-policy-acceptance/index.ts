import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  policyVersion?: string;
  acceptedAt?: string;
  source?: "EMAIL_SIGNUP" | "GOOGLE_SIGNUP" | "PROFILE_CONFIRMATION";
  audit?: {
    deviceLabel?: string | null;
    platform?: string | null;
    appVersion?: string | null;
    executionEnv?: string | null;
  };
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractClientIp(request: Request): string | null {
  const directHeaders = [
    request.headers.get("x-forwarded-for"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
  ];

  for (const header of directHeaders) {
    const normalized = String(header ?? "").trim();
    if (!normalized) continue;
    const firstIp = normalized.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase environment variables" });
  }

  if (!authorization) {
    return jsonResponse(401, { error: "Missing Authorization header" });
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const policyVersion = String(body.policyVersion ?? "").trim();
  const acceptedAt = String(body.acceptedAt ?? "").trim();
  const source = String(body.source ?? "").trim() || "PROFILE_CONFIRMATION";

  if (!policyVersion || !acceptedAt) {
    return jsonResponse(400, { error: "policyVersion and acceptedAt are required" });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, { error: "Invalid session" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const ipAddress = extractClientIp(request);
  const audit = body.audit ?? {};

  const { error: upsertError } = await adminClient.from("user_policy_acceptances").upsert(
    {
      user_id: user.id,
      policy_version: policyVersion,
      accepted_at: acceptedAt,
      acceptance_source: source,
      ip_address: ipAddress,
      device_label: audit.deviceLabel ?? null,
      platform: audit.platform ?? null,
      app_version: audit.appVersion ?? null,
      execution_env: audit.executionEnv ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    return jsonResponse(500, { error: upsertError.message });
  }

  return jsonResponse(200, { ok: true, ipAddress });
});
