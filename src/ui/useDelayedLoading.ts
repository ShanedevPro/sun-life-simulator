import { useEffect, useState } from 'react';

// Only an actual wait earns a hint; cached photos and crossfades stay quiet.
export function useDelayedLoading(requestKey: string, loading: boolean) {
  const [visibleFor, setVisibleFor] = useState<string | null>(null);
  useEffect(() => {
    setVisibleFor(null);
    if (!loading) return;
    const timer = window.setTimeout(() => setVisibleFor(requestKey), 1000);
    return () => window.clearTimeout(timer);
  }, [requestKey, loading]);
  return loading && visibleFor === requestKey;
}
