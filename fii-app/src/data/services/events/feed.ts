import { CACHE_TTL_EVENTS_MS, EVENTS_FEED_URL } from "./config";

export type EventsAssetClass = "FII" | "STOCK" | "ETF";

export type EventsFeedItem = {
  id: string;
  ticker: string;
  assetClass: EventsAssetClass;
  cvmCode?: number | null;
  companyName?: string | null;
  category: string;
  type: string;
  subject: string;
  referenceDate?: string | null;
  deliveredAt?: string | null;
  url: string;
};

type EventsFeedPayload = {
  generatedAt?: string | null;
  provider?: string | null;
  items?: EventsFeedItem[];
};

export type EventsDataSource = "SNAPSHOT" | "FALLBACK";

export type EventsFeedResult =
  | {
      ok: true;
      items: EventsFeedItem[];
      source: EventsDataSource;
      updatedAt: string | null;
      provider: string | null;
    }
  | { ok: false; message: string };

let memoryCache:
  | {
      savedAt: number;
      payload: Omit<Extract<EventsFeedResult, { ok: true }>, "ok">;
    }
  | null = null;

function toSafeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeItem(input: EventsFeedItem): EventsFeedItem {
  return {
    ...input,
    id: toSafeString(input.id),
    ticker: toSafeString(input.ticker).toUpperCase(),
    assetClass: input.assetClass,
    category: toSafeString(input.category),
    type: toSafeString(input.type),
    subject: toSafeString(input.subject),
    url: toSafeString(input.url),
    companyName: input.companyName ? toSafeString(input.companyName) : null,
    referenceDate: input.referenceDate ? toSafeString(input.referenceDate) : null,
    deliveredAt: input.deliveredAt ? toSafeString(input.deliveredAt) : null,
    cvmCode:
      typeof input.cvmCode === "number" && Number.isFinite(input.cvmCode)
        ? input.cvmCode
        : null,
  };
}

export async function getEventsFeed(options: { force: boolean }): Promise<EventsFeedResult> {
  if (!options.force && memoryCache && Date.now() - memoryCache.savedAt <= CACHE_TTL_EVENTS_MS) {
    return {
      ok: true,
      ...memoryCache.payload,
    };
  }

  try {
    const response = await fetch(EVENTS_FEED_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as EventsFeedPayload;
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const normalized = rawItems
      .map((item) => normalizeItem(item))
      .filter((item) => item.id && item.ticker && item.url);

    const result = {
      items: normalized,
      source: "SNAPSHOT" as const,
      updatedAt: payload.generatedAt ?? null,
      provider: payload.provider ?? null,
    };

    memoryCache = {
      savedAt: Date.now(),
      payload: result,
    };

    return { ok: true, ...result };
  } catch (error) {
    if (__DEV__) {
      console.log("[events] feed indisponível:", String(error));
    }

    // Keep the previous cache (if any). The UI can still show older data and surface an error.
    return { ok: false, message: "Não foi possível carregar os eventos agora." };
  }
}
