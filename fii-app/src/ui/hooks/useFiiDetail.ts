import { useCallback, useEffect, useState } from "react";

import type { FiiDetail } from "../../data/services/fiiService";
import { getFiiDetail, isOk } from "../../data/services/fiiService";

type UseFiiDetailResult = {
  detail: FiiDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useFiiDetail(ticker: string): UseFiiDetailResult {
  const [detail, setDetail] = useState<FiiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);

      const result = await getFiiDetail(ticker, { force });
      if (isOk(result)) {
        setDetail(result.data);
      } else {
        setError(result.message);
      }

      setLoading(false);
    },
    [ticker]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { detail, loading, error, refresh };
}
