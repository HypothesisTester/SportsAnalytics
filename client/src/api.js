// Data fetching. Responses are cached for the session (the data never changes
// between deploys), so going back to a game or list is instant.
import { useEffect, useRef, useState } from 'react';

const BASE = process.env.REACT_APP_EXPRESS_APP_API_URL || '/api';
const pending = new Map();
const resolved = new Map();

const urlFor = (path, params) => {
  const query = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v !== '' && v != null),
  ).toString();
  return BASE + path + (query ? `?${query}` : '');
};

export function getJSON(path, params) {
  const url = urlFor(path, params);
  if (!pending.has(url)) {
    // index.html may already have started this request while the app loaded.
    const early = window.__early && window.__early[url];
    if (early) delete window.__early[url];
    const request = (early || fetch(url)).then(async res => {
      // Searches answer 404 when nothing matches, and a missing game is a 404 too.
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`The server answered ${res.status}.`);
      return res.json();
    });
    request.then(data => resolved.set(url, data), () => pending.delete(url));
    pending.set(url, request);
  }
  return pending.get(url);
}

/** Start loading resources a view is about to need; failures are left for the view. */
export function prefetch(paths) {
  paths.forEach(path => getJSON(path).catch(() => {}));
}

/**
 * Fetch one resource. Pass a null path to fetch nothing. With keep, the last
 * result stays available while a new one loads (for inputs that refetch).
 */
export function useData(path, params, { keep = false } = {}) {
  const url = path == null ? null : urlFor(path, params);
  const last = useRef(undefined);
  const result = useDataInner(path, params, url);
  if (result.data !== undefined) last.current = result.data;
  return keep && result.data === undefined ? { ...result, data: last.current } : result;
}

function useDataInner(path, params, url) {
  const [state, setState] = useState({ url: null, data: undefined, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (url == null || resolved.has(url)) return undefined;
    let live = true;
    getJSON(path, params).then(
      data => live && setState({ url, data, error: null }),
      error => live && setState({ url, data: undefined, error }),
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, attempt]);

  if (url == null) return { data: undefined, loading: false, error: null };
  if (resolved.has(url)) return { data: resolved.get(url), loading: false, error: null };
  const current = state.url === url;
  return {
    data: current ? state.data : undefined,
    loading: !current || (state.data === undefined && !state.error),
    error: current ? state.error : null,
    retry: () => setAttempt(a => a + 1),
  };
}

/**
 * A list fetched 20 rows a page. While new filters load, the previous rows stay
 * on screen (marked stale) instead of flashing empty.
 */
const pagedMemory = new Map();

export function usePaged(path, params) {
  const key = urlFor(path, params);
  const keyRef = useRef(key);
  keyRef.current = key;
  // Coming back to a list shows every page loaded before, straight away, so the
  // scroll position can be restored.
  const [state, setState] = useState(() => {
    const remembered = pagedMemory.get(key);
    return remembered ? { key, ...remembered, loading: false, error: null }
      : { key: null, pages: [], done: false, loading: true, error: null };
  });

  useEffect(() => {
    if (state.key && !state.error) pagedMemory.set(state.key, { pages: state.pages, done: state.done });
  }, [state]);

  const fetchPage = (forKey, pageNo) => {
    setState(s => ({ ...s, loading: true, error: null }));
    getJSON(path, { ...params, page: pageNo }).then(
      rows => {
        if (keyRef.current !== forKey) return;
        setState(s => ({
          key: forKey,
          pages: pageNo === 1 ? [rows] : [...s.pages, rows],
          done: rows.length < 20,
          loading: false,
          error: null,
        }));
      },
      error => {
        if (keyRef.current !== forKey) return;
        setState(s => ({ ...s, loading: false, error }));
      },
    );
  };

  useEffect(() => {
    if (state.key === key) return;
    const remembered = pagedMemory.get(key);
    if (remembered) setState({ key, ...remembered, loading: false, error: null });
    else fetchPage(key, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = state.key === key;
  return {
    rows: state.pages.flat(),
    stale: !current,
    loading: state.loading,
    done: current && state.done,
    error: state.error,
    loadMore: () => {
      if (current && !state.loading && !state.done && !state.error) fetchPage(key, state.pages.length + 1);
    },
    retry: () => fetchPage(key, current ? state.pages.length + 1 : 1),
  };
}
