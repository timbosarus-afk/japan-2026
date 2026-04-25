// Offline cache module
// Saves trip data to localStorage on every successful load/save.
// Serves cached data when offline. Syncs back when online.

const CACHE_KEY = 'japan-2026-cache-v1';

export function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      cachedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.warn('Cache save failed:', e);
  }
}

export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    console.warn('Cache load failed:', e);
    return null;
  }
}

export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) { /* ignore */ }
}

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
