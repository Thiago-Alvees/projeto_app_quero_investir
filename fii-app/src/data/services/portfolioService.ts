import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  InvestmentPortfolio,
  PortfolioAssetRef,
  PortfolioVisibility,
} from "../../domain/models/portfolio";
import {
  ensureSupabaseUserId,
  getSupabaseClient,
  isSupabaseConfigured,
} from "./supabase/client";

const STORAGE_KEY = "investment:portfolios:v1";
const CLOUD_MIGRATION_KEY = "investment:portfolios:cloud-migrated:v1";

type CloudMode = "CLOUD" | "LOCAL";

type PortfolioRow = {
  id: string;
  owner_id: string;
  name: string;
  visibility: PortfolioVisibility;
  monthly_contribution: number;
  months: number;
  reinvest_dividends: boolean;
  share_code: string | null;
  created_at: string;
  updated_at: string;
  assets?: PortfolioAssetRow[] | null;
};

type PortfolioAssetRow = {
  asset_class: "FII" | "STOCK" | "ETF";
  ticker: string;
  position: number | null;
};

let memoryCache: InvestmentPortfolio[] | null = null;
let cloudMode: CloudMode = "LOCAL";
let migrationPromise: Promise<void> | null = null;

function sortByUpdatedAtDesc(items: InvestmentPortfolio[]): InvestmentPortfolio[] {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function buildId(): string {
  return `pf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildShareCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return output;
}

function mapAssets(rows: PortfolioAssetRow[] | null | undefined): PortfolioAssetRef[] {
  if (!Array.isArray(rows)) return [];
  return [...rows]
    .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER))
    .map((row) => ({
      assetClass: row.asset_class,
      ticker: row.ticker,
    }));
}

function mapRowToPortfolio(row: PortfolioRow): InvestmentPortfolio {
  return {
    id: row.id,
    name: row.name,
    visibility: row.visibility,
    monthlyContribution: Number(row.monthly_contribution) || 0,
    months: Number(row.months) || 1,
    reinvestDividends: Boolean(row.reinvest_dividends),
    assets: mapAssets(row.assets),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shareCode: row.share_code ?? null,
    ownerId: row.owner_id ?? null,
  };
}

function mapPortfolioToRow(
  portfolio: InvestmentPortfolio,
  ownerId: string
): Omit<PortfolioRow, "assets"> {
  return {
    id: portfolio.id,
    owner_id: ownerId,
    name: portfolio.name,
    visibility: portfolio.visibility,
    monthly_contribution: portfolio.monthlyContribution,
    months: portfolio.months,
    reinvest_dividends: portfolio.reinvestDividends,
    share_code: portfolio.shareCode ?? null,
    created_at: portfolio.createdAt,
    updated_at: portfolio.updatedAt,
  };
}

function mapAssetsToRows(
  portfolioId: string,
  assets: PortfolioAssetRef[]
): Array<PortfolioAssetRow & { portfolio_id: string }> {
  return assets.map((asset, index) => ({
    portfolio_id: portfolioId,
    asset_class: asset.assetClass,
    ticker: asset.ticker,
    position: index,
  }));
}

async function readLocalAll(): Promise<InvestmentPortfolio[]> {
  if (memoryCache) return sortByUpdatedAtDesc(memoryCache);

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryCache = [];
      return [];
    }

    const parsed = JSON.parse(raw) as InvestmentPortfolio[];
    memoryCache = Array.isArray(parsed) ? parsed : [];
    return sortByUpdatedAtDesc(memoryCache);
  } catch {
    memoryCache = [];
    return [];
  }
}

async function persistLocal(items: InvestmentPortfolio[]): Promise<void> {
  memoryCache = sortByUpdatedAtDesc(items);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
  } catch {
    // ignore local persistence errors
  }
}

async function listCloud(scope: "OWN" | "PUBLIC"): Promise<InvestmentPortfolio[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  let query = supabase
    .from("investment_portfolios")
    .select(
      `
      id,
      owner_id,
      name,
      visibility,
      monthly_contribution,
      months,
      reinvest_dividends,
      share_code,
      created_at,
      updated_at,
      assets:investment_portfolio_assets(asset_class,ticker,position)
    `
    )
    .order("updated_at", { ascending: false });

  if (scope === "OWN") {
    const ownerId = await ensureSupabaseUserId();
    if (!ownerId) return null;
    query = query.eq("owner_id", ownerId);
  } else {
    query = query.eq("visibility", "PUBLICA").limit(80);
  }

  const { data, error } = await query;
  if (error) {
    if (__DEV__) console.log("[portfolio] cloud list failed:", error.message);
    return null;
  }

  const rows = Array.isArray(data) ? (data as PortfolioRow[]) : [];
  return rows.map(mapRowToPortfolio);
}

async function getCloudById(id: string): Promise<InvestmentPortfolio | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("investment_portfolios")
    .select(
      `
      id,
      owner_id,
      name,
      visibility,
      monthly_contribution,
      months,
      reinvest_dividends,
      share_code,
      created_at,
      updated_at,
      assets:investment_portfolio_assets(asset_class,ticker,position)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (__DEV__) console.log("[portfolio] cloud get failed:", error.message);
    return null;
  }

  if (!data) return null;
  return mapRowToPortfolio(data as PortfolioRow);
}

async function saveCloud(
  input: Omit<InvestmentPortfolio, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  }
): Promise<InvestmentPortfolio | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const ownerId = await ensureSupabaseUserId();
  if (!ownerId) return null;

  const now = new Date().toISOString();
  const targetId = input.id ?? buildId();
  const existing = input.id ? await getCloudById(input.id) : null;

  const base: InvestmentPortfolio = {
    id: targetId,
    name: input.name,
    visibility: input.visibility,
    monthlyContribution: input.monthlyContribution,
    months: input.months,
    reinvestDividends: input.reinvestDividends,
    assets: input.assets,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    shareCode:
      input.visibility === "PUBLICA"
        ? existing?.shareCode ?? buildShareCode()
        : null,
    ownerId,
  };

  let lastErrorMessage = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const maybeShareCode =
      base.visibility === "PUBLICA"
        ? attempt === 0
          ? base.shareCode
          : buildShareCode()
        : null;

    const row = mapPortfolioToRow(
      { ...base, shareCode: maybeShareCode },
      ownerId
    );

    const { error: upsertError } = await supabase
      .from("investment_portfolios")
      .upsert(row, { onConflict: "id" });

    if (upsertError) {
      lastErrorMessage = upsertError.message;
      const errorCode = (upsertError as { code?: string }).code ?? "";
      const isUniqueViolation =
        errorCode === "23505" ||
        upsertError.message.toLowerCase().includes("duplicate") ||
        upsertError.message.toLowerCase().includes("unique");
      if (isUniqueViolation && base.visibility === "PUBLICA") {
        continue;
      }
      if (__DEV__) console.log("[portfolio] cloud save failed:", upsertError.message);
      return null;
    }

    const { error: clearError } = await supabase
      .from("investment_portfolio_assets")
      .delete()
      .eq("portfolio_id", targetId);

    if (clearError) {
      if (__DEV__) console.log("[portfolio] cloud clear assets failed:", clearError.message);
      return null;
    }

    const rows = mapAssetsToRows(targetId, base.assets);
    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("investment_portfolio_assets")
        .insert(rows);
      if (insertError) {
        if (__DEV__) {
          console.log("[portfolio] cloud insert assets failed:", insertError.message);
        }
        return null;
      }
    }

    return {
      ...base,
      shareCode: maybeShareCode ?? null,
    };
  }

  if (__DEV__ && lastErrorMessage) {
    console.log("[portfolio] failed to generate unique share code:", lastErrorMessage);
  }
  return null;
}

async function deleteCloud(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const ownerId = await ensureSupabaseUserId();
  if (!ownerId) return false;

  const { error } = await supabase
    .from("investment_portfolios")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (error) {
    if (__DEV__) console.log("[portfolio] cloud delete failed:", error.message);
    return false;
  }

  return true;
}

async function migrateLocalToCloudIfNeeded(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    try {
      const alreadyMigrated = await AsyncStorage.getItem(CLOUD_MIGRATION_KEY);
      if (alreadyMigrated === "1") return;

      const supabase = getSupabaseClient();
      const ownerId = await ensureSupabaseUserId();
      if (!supabase || !ownerId) return;

      const localItems = await readLocalAll();
      for (const portfolio of localItems) {
        const row = mapPortfolioToRow(
          {
            ...portfolio,
            ownerId,
            shareCode:
              portfolio.visibility === "PUBLICA"
                ? portfolio.shareCode ?? buildShareCode()
                : null,
          },
          ownerId
        );

        const { error: upsertError } = await supabase
          .from("investment_portfolios")
          .upsert(row, { onConflict: "id" });
        if (upsertError) {
          if (__DEV__) {
            console.log("[portfolio] migration upsert failed:", upsertError.message);
          }
          return;
        }

        const { error: clearError } = await supabase
          .from("investment_portfolio_assets")
          .delete()
          .eq("portfolio_id", portfolio.id);
        if (clearError) {
          if (__DEV__) {
            console.log("[portfolio] migration clear assets failed:", clearError.message);
          }
          return;
        }

        const rows = mapAssetsToRows(portfolio.id, portfolio.assets);
        if (rows.length > 0) {
          const { error: insertError } = await supabase
            .from("investment_portfolio_assets")
            .insert(rows);
          if (insertError) {
            if (__DEV__) {
              console.log("[portfolio] migration insert assets failed:", insertError.message);
            }
            return;
          }
        }
      }

      await AsyncStorage.setItem(CLOUD_MIGRATION_KEY, "1");
    } catch (error) {
      if (__DEV__) console.log("[portfolio] migration failed:", String(error));
    }
  })().finally(() => {
    migrationPromise = null;
  });

  return migrationPromise;
}

function upsertIntoLocalCache(item: InvestmentPortfolio, collection: InvestmentPortfolio[]): InvestmentPortfolio[] {
  const index = collection.findIndex((portfolio) => portfolio.id === item.id);
  if (index < 0) {
    return sortByUpdatedAtDesc([item, ...collection]);
  }
  const next = [...collection];
  next[index] = item;
  return sortByUpdatedAtDesc(next);
}

export function getPortfolioStorageMode(): CloudMode {
  return cloudMode;
}

export function isPortfolioCloudEnabled(): boolean {
  return isSupabaseConfigured();
}

export async function listPortfolios(): Promise<InvestmentPortfolio[]> {
  if (isSupabaseConfigured()) {
    await migrateLocalToCloudIfNeeded();
    const cloudItems = await listCloud("OWN");
    if (cloudItems) {
      cloudMode = "CLOUD";
      await persistLocal(cloudItems);
      return cloudItems;
    }
  }

  cloudMode = "LOCAL";
  return readLocalAll();
}

export async function listPublicPortfolios(): Promise<InvestmentPortfolio[]> {
  if (isSupabaseConfigured()) {
    const cloudItems = await listCloud("PUBLIC");
    if (cloudItems) {
      cloudMode = "CLOUD";
      return cloudItems;
    }
  }

  const local = await readLocalAll();
  cloudMode = "LOCAL";
  return local.filter((item) => item.visibility === "PUBLICA");
}

export async function getPortfolioById(id: string): Promise<InvestmentPortfolio | null> {
  if (isSupabaseConfigured()) {
    const cloudItem = await getCloudById(id);
    if (cloudItem) {
      cloudMode = "CLOUD";
      const local = await readLocalAll();
      await persistLocal(upsertIntoLocalCache(cloudItem, local));
      return cloudItem;
    }
  }

  const all = await readLocalAll();
  cloudMode = "LOCAL";
  return all.find((item) => item.id === id) ?? null;
}

export async function savePortfolio(
  input: Omit<InvestmentPortfolio, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  }
): Promise<InvestmentPortfolio> {
  if (isSupabaseConfigured()) {
    await migrateLocalToCloudIfNeeded();
    const cloudSaved = await saveCloud(input);
    if (cloudSaved) {
      cloudMode = "CLOUD";
      const local = await readLocalAll();
      await persistLocal(upsertIntoLocalCache(cloudSaved, local));
      return cloudSaved;
    }

    throw new Error("Faça login em uma conta válida para salvar carteiras na nuvem.");
  }

  cloudMode = "LOCAL";
  const all = await readLocalAll();
  const now = new Date().toISOString();

  if (!input.id) {
    const created: InvestmentPortfolio = {
      ...input,
      id: buildId(),
      createdAt: now,
      updatedAt: now,
      shareCode: input.visibility === "PUBLICA" ? buildShareCode() : null,
      ownerId: null,
    };
    await persistLocal([created, ...all]);
    return created;
  }

  const index = all.findIndex((item) => item.id === input.id);
  if (index < 0) {
    const created: InvestmentPortfolio = {
      ...input,
      id: input.id,
      createdAt: now,
      updatedAt: now,
      shareCode: input.visibility === "PUBLICA" ? buildShareCode() : null,
      ownerId: null,
    };
    await persistLocal([created, ...all]);
    return created;
  }

  const current = all[index];
  const updated: InvestmentPortfolio = {
    ...current,
    ...input,
    updatedAt: now,
    shareCode:
      input.visibility === "PUBLICA"
        ? current.shareCode ?? buildShareCode()
        : null,
  };

  const next = [...all];
  next[index] = updated;
  await persistLocal(next);
  return updated;
}

export async function deletePortfolio(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const deletedCloud = await deleteCloud(id);
    if (!deletedCloud) {
      throw new Error("Não foi possível excluir a carteira na nuvem.");
    }

    cloudMode = "CLOUD";
    const all = await readLocalAll();
    const next = all.filter((item) => item.id !== id);
    await persistLocal(next);
    return;
  }

  cloudMode = "LOCAL";
  const all = await readLocalAll();
  const next = all.filter((item) => item.id !== id);
  await persistLocal(next);
}

export async function deleteAllPortfoliosForCurrentUser(): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const ownerId = await ensureSupabaseUserId();
    if (supabase && ownerId) {
      const { error } = await supabase
        .from("investment_portfolios")
        .delete()
        .eq("owner_id", ownerId);

      if (!error) {
        cloudMode = "CLOUD";
        await persistLocal([]);
        return true;
      }

      if (__DEV__) console.log("[portfolio] cloud delete all failed:", error.message);
      return false;
    }

    return false;
  }

  cloudMode = "LOCAL";
  await persistLocal([]);
  return true;
}
