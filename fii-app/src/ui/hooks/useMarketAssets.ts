import { useCallback, useEffect, useState } from "react";

import type { MarketAsset } from "../../domain/models/marketAsset";
import type { MarketDataSource } from "../../data/services/marketService";
import { getMarketAssets } from "../../data/services/marketService";

type UseMarketAssetsResult = {
  assets: MarketAsset[];
  loading: boolean;
  error: string | null;
  source: MarketDataSource;
  updatedAt: string | null;
  refresh: () => Promise<void>;
};

export function useMarketAssets(): UseMarketAssetsResult {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<MarketDataSource>("MOCK");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    const result = await getMarketAssets({ force });
    if ("message" in result) {
      setError(result.message);
      setLoading(false);
      return;
    }

    setAssets(result.data);
    setSource(result.source);
    setUpdatedAt(result.updatedAt ?? null);

    setLoading(false);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { assets, loading, error, source, updatedAt, refresh };
}
