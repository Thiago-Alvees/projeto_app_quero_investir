import { useEffect, useState } from "react";

import type { ReferenceRates } from "../../data/services/ratesService";
import { FALLBACK_REFERENCE_RATES, getReferenceRates } from "../../data/services/ratesService";

type UseReferenceRatesResult = {
  rates: ReferenceRates | null;
  loading: boolean;
};

export function useReferenceRates(): UseReferenceRatesResult {
  const [rates, setRates] = useState<ReferenceRates | null>(FALLBACK_REFERENCE_RATES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const data = await getReferenceRates();
      if (!active) return;
      setRates(data);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  return { rates, loading };
}
