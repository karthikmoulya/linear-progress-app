import { useEffect, useState } from "react";

// Fetches `path` and refetches whenever `version` changes.
// On error the last good data is kept, so the page doesn't go blank.
export function useApi(path, version = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: null, status: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    fetch(path)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const err = new Error(body?.detail || `Backend unavailable (HTTP ${res.status})`);
          err.status = res.status;
          throw err;
        }
        return body;
      })
      .then((data) => !cancelled && setState({ data, loading: false, error: null, status: 200 }))
      .catch((err) => {
        const message = err instanceof TypeError ? "Can't reach the backend" : err.message;
        if (!cancelled) setState((s) => ({ data: s.data, loading: false, error: message, status: err.status ?? null }));
      });

    return () => {
      cancelled = true;
    };
  }, [path, version]);

  return state;
}
