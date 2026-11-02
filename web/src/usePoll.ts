import { useCallback, useEffect, useRef, useState } from 'react';

/** Calls `fetcher` now and every `ms` milliseconds, so views follow changes the agents make. */
export function usePoll<T>(fetcher: () => Promise<T>, ms = 2000) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(() => {
    fetcherRef.current().then(
      (d) => { setData(d); setError(undefined); },
      (e: Error) => setError(e.message),
    );
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, ms);
    return () => clearInterval(timer);
  }, [refresh, ms]);

  return { data, error, refresh };
}
