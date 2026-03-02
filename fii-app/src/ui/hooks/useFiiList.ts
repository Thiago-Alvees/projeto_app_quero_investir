import { useCallback, useEffect, useState } from "react";

import type { Fii } from "../../domain/models/fii";
import type { DataSource } from "../../data/services/fiiService";
import { getFiiList, isOk } from "../../data/services/fiiService";

type UseFiiListResult = {
  fiis: Fii[];
  loading: boolean;
  error: string | null;
  source: DataSource;
  updatedAt: string | null;
  fundamentalsUpdatedAt: string | null;
  refresh: () => Promise<void>;
};

export function useFiiList(): UseFiiListResult {
  const [fiis, setFiis] = useState<Fii[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState<DataSource>("MOCK");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [fundamentalsUpdatedAt, setFundamentalsUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    const result = await getFiiList({ force });

    if (isOk(result)) {
      setFiis(result.data);
      setSource(result.source);
      setUpdatedAt(result.updatedAt ?? null);
      setFundamentalsUpdatedAt(result.fundamentalsUpdatedAt ?? null);
    } else {
      setError(result.message);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return {
    fiis,
    loading,
    error,
    source,
    updatedAt,
    fundamentalsUpdatedAt,
    refresh,
  };
}
