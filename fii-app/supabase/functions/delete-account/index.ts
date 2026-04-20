import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
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

  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  const accessTokenPayload = parseJwtPayload(accessToken);
  const issuedAt = Number(accessTokenPayload?.iat ?? 0);
  const sessionAgeSeconds = Math.floor(Date.now() / 1000) - issuedAt;

  if (!Number.isFinite(issuedAt) || sessionAgeSeconds > 5 * 60) {
    return jsonResponse(403, { error: "Recent reauthentication required" });
  }

  const body = await request.json().catch(() => ({}));
  const confirmed = Boolean((body as { confirm?: boolean }).confirm);
  if (!confirmed) {
    return jsonResponse(400, { error: "Confirmation required" });
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

  // Defensive cleanup in case foreign keys are changed in the future.
  await adminClient.from("investment_portfolios").delete().eq("owner_id", user.id);

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id, false);
  if (deleteError) {
    return jsonResponse(500, { error: deleteError.message });
  }

  return jsonResponse(200, { ok: true });
});
