import { useCallback, useEffect, useState } from "react";

import {
  getInvestmentCatalog,
  type InvestmentCatalogResult,
} from "../../data/services/investmentCatalogService";
import type { PortfolioAssetCatalogItem } from "../../data/mock/investmentCatalog";

type UseInvestmentCatalogResult = {
  items: PortfolioAssetCatalogItem[];
  byKey: Map<string, PortfolioAssetCatalogItem>;
  loading: boolean;
  source: "SNAPSHOT" | "FALLBACK";
  updatedAt: string | null;
  refresh: () => Promise<void>;
};

const EMPTY_MAP = new Map<string, PortfolioAssetCatalogItem>();

export function useInvestmentCatalog(): UseInvestmentCatalogResult {
  const [items, setItems] = useState<PortfolioAssetCatalogItem[]>([]);
  const [byKey, setByKey] = useState<Map<string, PortfolioAssetCatalogItem>>(EMPTY_MAP);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<InvestmentCatalogResult["source"]>("FALLBACK");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    const result = await getInvestmentCatalog({ force });
    setItems(result.items);
    setByKey(result.byKey);
    setSource(result.source);
    setUpdatedAt(result.updatedAt);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { items, byKey, loading, source, updatedAt, refresh };
}
