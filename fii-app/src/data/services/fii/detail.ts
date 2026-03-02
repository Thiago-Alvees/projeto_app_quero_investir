import { BRAPI_BASE_URL, CACHE_TTL_DETAIL_MS, DETAIL_CACHE_PREFIX } from "./config";
import { readCache, writeCache } from "./cache";
import { parseBrapiDetail } from "./parsers";
import type { BrapiQuoteResponse, FiiDetail, Result } from "./types";
import { getBrapiProxyUrl, getBrapiToken, normalizeBaseUrl, toUpper } from "./utils";

export async function getFiiDetail(
  ticker: string,
  options: { force: boolean }
): Promise<Result<FiiDetail>> {
  const cacheKey = `${DETAIL_CACHE_PREFIX}${toUpper(ticker)}`;
  const cached = options.force
    ? null
    : await readCache<FiiDetail>(cacheKey, CACHE_TTL_DETAIL_MS);

  if (cached) {
    return { ok: true, data: cached, source: "SNAPSHOT" };
  }

  try {
    const token = getBrapiToken();
    const proxyUrl = getBrapiProxyUrl();
    const baseUrl = proxyUrl ? normalizeBaseUrl(proxyUrl) : BRAPI_BASE_URL;
    const isProxy = Boolean(proxyUrl);

    const query = [
      "modules=summaryProfile",
      "range=3mo",
      "interval=1d",
      !isProxy && token ? `token=${encodeURIComponent(token)}` : null,
    ]
      .filter(Boolean)
      .join("&");

    const url = `${baseUrl}/${encodeURIComponent(toUpper(ticker))}?${query}`;
    const response = await fetch(url);

    if (!response.ok) {
      return {
        ok: false,
        message:
          response.status === 401
            ? "Token BRAPI inválido ou ausente."
            : response.status === 402
              ? "Limite do plano BRAPI excedido."
              : `Erro ao buscar detalhes (${response.status}).`,
      };
    }

    const json = (await response.json()) as BrapiQuoteResponse;
    const detail = parseBrapiDetail(json);

    if (!detail) {
      return { ok: false, message: "Detalhes não encontrados para este ativo." };
    }

    await writeCache(cacheKey, detail);
    return { ok: true, data: detail, source: "SNAPSHOT" };
  } catch (error) {
    if (__DEV__) console.log("[brapi] falha ao buscar detalhes:", String(error));
    return { ok: false, message: "Não foi possível carregar detalhes agora." };
  }
}
