import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const output = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    output[key] = value;
  }

  return output;
}

function resolveConfig() {
  const envPath = path.join(process.cwd(), ".env");
  const fileEnv = parseEnvFile(envPath);
  const supabaseUrl = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || "";

  return {
    supabaseUrl: String(supabaseUrl).trim(),
    supabaseAnonKey: String(supabaseAnonKey).trim(),
  };
}

async function main() {
  const { supabaseUrl, supabaseAnonKey } = resolveConfig();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[validate:supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY in fii-app/.env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log("[validate:supabase] Step 1/3: anonymous auth...");
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  if (authError) {
    console.error("[validate:supabase] Anonymous auth failed:", authError.message);
    console.error("Hint: enable Anonymous Sign-Ins in Supabase Authentication > Providers.");
    process.exit(1);
  }
  const userId = authData.user?.id || authData.session?.user?.id || null;
  if (!userId) {
    console.error("[validate:supabase] Anonymous auth returned no user id.");
    process.exit(1);
  }
  console.log(`[validate:supabase] OK: user id ${userId}`);

  console.log("[validate:supabase] Step 2/3: checking table investment_portfolios...");
  const { error: portfoliosError } = await supabase
    .from("investment_portfolios")
    .select("id", { count: "exact", head: true })
    .limit(1);

  if (portfoliosError) {
    console.error("[validate:supabase] Table or policy check failed:", portfoliosError.message);
    console.error("Hint: run SQL from fii-app/SUPABASE_SETUP.md in Supabase SQL Editor.");
    process.exit(1);
  }
  console.log("[validate:supabase] OK: investment_portfolios table reachable.");

  console.log("[validate:supabase] Step 3/3: checking table investment_portfolio_assets...");
  const { error: assetsError } = await supabase
    .from("investment_portfolio_assets")
    .select("portfolio_id", { count: "exact", head: true })
    .limit(1);

  if (assetsError) {
    console.error("[validate:supabase] Assets table or policy check failed:", assetsError.message);
    console.error("Hint: run SQL from fii-app/SUPABASE_SETUP.md in Supabase SQL Editor.");
    process.exit(1);
  }
  console.log("[validate:supabase] OK: investment_portfolio_assets table reachable.");

  console.log("[validate:supabase] SUCCESS: Supabase configured and reachable.");
}

main().catch((error) => {
  console.error("[validate:supabase] Unexpected error:", String(error));
  process.exit(1);
});
