import Constants from "expo-constants";

export function toUpper(value: string): string {
  return value.toUpperCase().trim();
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeDyStatus(value: unknown): "OK" | "APURACAO" | undefined {
  if (value === "OK") return "OK";
  if (value === "APURACAO") return "APURACAO";
  return undefined;
}

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function getExtraValue(key: "BRAPI_TOKEN" | "BRAPI_PROXY_URL"): string | null {
  const extra =
    (Constants.expoConfig?.extra as { [k: string]: string | undefined } | undefined) ??
    {};

  const manifestExtra = (
    Constants as { manifest?: { extra?: { [k: string]: string | undefined } } }
  ).manifest?.extra;

  const value = extra[key] ?? manifestExtra?.[key] ?? "";
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export function getBrapiToken(): string | null {
  return getExtraValue("BRAPI_TOKEN");
}

export function getBrapiProxyUrl(): string | null {
  return getExtraValue("BRAPI_PROXY_URL");
}
