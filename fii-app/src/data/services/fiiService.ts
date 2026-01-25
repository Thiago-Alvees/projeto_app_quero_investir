// src/data/services/fiiService.ts

import type { Fii } from "../../domain/models/fii";
import { FIIS_MOCK } from "../mock/fiis";

export type DataSource = "SNAPSHOT" | "MOCK";

export type Result<T> =
  | { ok: true; data: T; source: DataSource; updatedAt?: string | null }
  | { ok: false; message: string };

export function isOk<T>(r: Result<T>): r is { ok: true; data: T; source: DataSource; updatedAt?: string | null } {
  return r.ok === true;
}

type Snapshot = {
  generatedAt: string | null;
  provider: string;
  items: Array<{ ticker: string; price: number | null }>;
};

// IMPORTANTE: coloque aqui o seu repo e branch
// Exemplo:
// https://raw.githubusercontent.com/Thiago-Alvees/projeto_app_quero_investir/main/data/fiis_snapshot.json
const SNAPSHOT_URL =
  "https://raw.githubusercontent.com/Thiago-Alvees/app_snapshot/main/data/fiis_snapshot.json";


async function fetchSnapshot(): Promise<Snapshot> {
  const res = await fetch(SNAPSHOT_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as Snapshot;

  // validação defensiva
  if (!json || !Array.isArray(json.items)) throw new Error("Snapshot inválido");
  return json;
}

export async function getFiiList(): Promise<Result<Fii[]>> {
  try {
    const base = FIIS_MOCK;

    try {
      const snap = await fetchSnapshot();
      const priceMap = new Map(
        snap.items.map((x) => [String(x.ticker).toUpperCase(), x.price])
      );

      const merged: Fii[] = base.map((x) => ({
        ...x,
        price: typeof priceMap.get(x.ticker.toUpperCase()) === "number"
          ? (priceMap.get(x.ticker.toUpperCase()) as number)
          : x.price,
      }));

      return { ok: true, data: merged, source: "SNAPSHOT", updatedAt: snap.generatedAt };
    } catch (e) {
      if (__DEV__) console.log("[snapshot] falhou, usando MOCK:", String(e));
      return { ok: true, data: base, source: "MOCK", updatedAt: null };
    }
  } catch {
    return { ok: false, message: "Não foi possível carregar os dados agora. Tente novamente." };
  }
}

export async function getFiiByTicker(ticker: string): Promise<Result<Fii>> {
  try {
    const base = FIIS_MOCK.find(
      (x) => x.ticker.toUpperCase() === ticker.toUpperCase()
    );
    if (!base) return { ok: false, message: "FII não encontrado." };

    // Para o detalhe, não precisamos chamar snapshot de novo (evita rede)
    return { ok: true, data: base, source: "MOCK", updatedAt: null };
  } catch {
    return { ok: false, message: "Não foi possível carregar este FII agora. Tente novamente." };
  }
}
