import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getEventsFeed,
  type EventsDataSource,
  type EventsFeedItem,
} from "../../data/services/events/feed";

type UseEventsFeedResult = {
  items: EventsFeedItem[];
  loading: boolean;
  error: string | null;
  source: EventsDataSource;
  updatedAt: string | null;
  provider: string | null;
  refresh: () => Promise<void>;
};

export function useEventsFeed(): UseEventsFeedResult {
  const [items, setItems] = useState<EventsFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<EventsDataSource>("FALLBACK");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    const result = await getEventsFeed({ force });
    if (result.ok === false) {
      setError(result.message || "Não foi possível carregar os eventos agora.");
      setLoading(false);
      return;
    }

    setItems(result.items);
    setSource(result.source);
    setUpdatedAt(result.updatedAt ?? null);
    setProvider(result.provider ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return useMemo(
    () => ({ items, loading, error, source, updatedAt, provider, refresh }),
    [items, loading, error, source, updatedAt, provider, refresh]
  );
}
