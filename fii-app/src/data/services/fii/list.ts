import type { Fii } from "../../../domain/models/fii";
import { FIIS_MOCK } from "../../mock/fiis";
import { FII_TYPE_BY_TICKER, FII_UNIVERSE } from "../../static/fiiUniverse";
import {
  CACHE_TTL_LIST_MS,
  FUNDAMENTALS_URL,
  LIST_CACHE_KEY,
  SNAPSHOT_URL,
  getLocalFundamentals,
} from "./config";
import { readCache, writeCache } from "./cache";
import type { FiiListCache, Fundamentals, Result, Snapshot } from "./types";
import { normalizeDyStatus, toNumber, toUpper } from "./utils";

type NormalizedFundamental = {
  vp?: number;
  dy12m?: number;
  dyStatus?: "OK" | "APURACAO";
  pl?: number;
};

async function fetchSnapshot(): Promise<Snapshot> {
  const response = await fetch(SNAPSHOT_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = (await response.json()) as Snapshot;
  if (!json || !Array.isArray(json.items)) throw new Error("Snapshot inválido.");
  return json;
}

async function fetchFundamentals(): Promise<Fundamentals> {
  const response = await fetch(FUNDAMENTALS_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = (await response.json()) as Fundamentals;
  if (!json || !Array.isArray(json.items)) throw new Error("Fundamentos inválidos.");
  return json;
}

function hasUsableFundamentals(fundamentals: Fundamentals | null): boolean {
  if (!fundamentals || !Array.isArray(fundamentals.items) || !fundamentals.items.length) {
    return false;
  }

  return fundamentals.items.some((item) => {
    const vp = toNumber(item.vp);
    const dy12m = toNumber(item.dy12m);
    const pl = toNumber(item.pl);
    return vp !== null || dy12m !== null || pl !== null;
  });
}

function toValidPositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeFundamentals(fundamentals: Fundamentals | null): {
  map: Map<string, NormalizedFundamental>;
  updatedAt: string | null;
} {
  const map = new Map<string, NormalizedFundamental>();

  if (!fundamentals || !Array.isArray(fundamentals.items)) {
    return { map, updatedAt: null };
  }

  for (const item of fundamentals.items) {
    const ticker = toUpper(item.ticker);
    const vp = toNumber(item.vp);
    const dy = toNumber(item.dy12m);
    const pl = toNumber(item.pl);

    let dyStatus = normalizeDyStatus(item.dyStatus);
    if (dy === null && dyStatus !== "OK") {
      dyStatus = "APURACAO";
    }
    if (dy !== null) {
      dyStatus = "OK";
    }

    const normalized: NormalizedFundamental = {
      vp: vp ?? undefined,
      dy12m: dy ?? undefined,
      dyStatus,
      pl: pl ?? undefined,
    };

    if (
      normalized.vp !== undefined ||
      normalized.dy12m !== undefined ||
      normalized.dyStatus !== undefined ||
      normalized.pl !== undefined
    ) {
      map.set(ticker, normalized);
    }
  }

  return { map, updatedAt: fundamentals.updatedAt ?? null };
}

function mergeTicker(
  ticker: string,
  mock: Fii | undefined,
  fundamentals: NormalizedFundamental | undefined,
  snapshotPrice: number | undefined
): Fii {
  const mockPrice = toValidPositiveNumber(mock?.price) ?? 0;
  const resolvedPrice = toValidPositiveNumber(snapshotPrice) ?? mockPrice;

  const vp = toValidPositiveNumber(fundamentals?.vp) ?? toValidPositiveNumber(mock?.vp);
  const pl = toValidPositiveNumber(fundamentals?.pl) ?? toValidPositiveNumber(mock?.pl);
  const pvp = toValidPositiveNumber(mock?.pvp);

  const hasFundamentalsDy = toValidPositiveNumber(fundamentals?.dy12m) !== undefined;
  const mockDy = toValidPositiveNumber(mock?.dividendYield12m);

  let dividendYield12m = Number.NaN;
  let dyStatus: "OK" | "APURACAO" | undefined;

  if (hasFundamentalsDy) {
    dividendYield12m = fundamentals?.dy12m as number;
    dyStatus = "OK";
  } else if (fundamentals) {
    dividendYield12m = Number.NaN;
    dyStatus = fundamentals.dyStatus ?? "APURACAO";
  } else if (mockDy !== undefined) {
    dividendYield12m = mockDy;
    dyStatus = mock?.dyStatus ?? "OK";
  }

  return {
    ticker,
    type: FII_TYPE_BY_TICKER[ticker],
    price: resolvedPrice,
    vp,
    pvp,
    dividendYield12m,
    dyStatus,
    pl,
  };
}

export async function getFiiList(options: { force: boolean }): Promise<Result<Fii[]>> {
  const cached = options.force
    ? null
    : await readCache<FiiListCache>(LIST_CACHE_KEY, CACHE_TTL_LIST_MS);

  if (cached) {
    return {
      ok: true,
      data: cached.data,
      source: cached.source,
      updatedAt: cached.updatedAt,
      fundamentalsUpdatedAt: cached.fundamentalsUpdatedAt,
    };
  }

  try {
    const mockMap = new Map<string, Fii>();
    for (const mock of FIIS_MOCK) {
      mockMap.set(toUpper(mock.ticker), mock);
    }

    let source: "SNAPSHOT" | "MOCK" = "MOCK";
    let updatedAt: string | null = null;
    const priceMap = new Map<string, number>();

    try {
      const snapshot = await fetchSnapshot();
      updatedAt = snapshot.generatedAt ?? null;
      for (const item of snapshot.items) {
        const ticker = toUpper(item.ticker);
        const price = toValidPositiveNumber(item.price);
        if (price !== undefined) {
          priceMap.set(ticker, price);
        }
      }
      source = "SNAPSHOT";
    } catch (error) {
      if (__DEV__) console.log("[snapshot] fallback para mock:", String(error));
    }

    let fundamentals: Fundamentals | null = null;
    try {
      fundamentals = await fetchFundamentals();
    } catch (error) {
      if (__DEV__) console.log("[fundamentals] remoto indisponível:", String(error));
    }

    if (!hasUsableFundamentals(fundamentals)) {
      fundamentals = getLocalFundamentals();
      if (__DEV__) console.log("[fundamentals] usando fallback local.");
    }

    const normalizedFundamentals = normalizeFundamentals(fundamentals);

    const merged: Fii[] = FII_UNIVERSE.map((ticker) =>
      mergeTicker(
        toUpper(ticker),
        mockMap.get(toUpper(ticker)),
        normalizedFundamentals.map.get(toUpper(ticker)),
        priceMap.get(toUpper(ticker))
      )
    );

    const result: FiiListCache = {
      data: merged,
      source,
      updatedAt,
      fundamentalsUpdatedAt: normalizedFundamentals.updatedAt,
    };

    await writeCache(LIST_CACHE_KEY, result);

    return {
      ok: true,
      data: merged,
      source,
      updatedAt,
      fundamentalsUpdatedAt: normalizedFundamentals.updatedAt,
    };
  } catch {
    return {
      ok: false,
      message: "Não foi possível carregar os dados agora. Tente novamente.",
    };
  }
}
