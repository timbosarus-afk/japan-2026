// FX rate module
// Fetches live rates from a free public API.
// Caches rates in localStorage, refreshes daily.

const FX_CACHE_KEY = 'japan-2026-fx-v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Fallback rates if API fails — approximate, used only as last resort
const FALLBACK = {
  GBP_per_JPY: 0.0053,  // 1 JPY = 0.0053 GBP
  GBP_per_KRW: 0.00056, // 1 KRW = 0.00056 GBP
};

export async function getRates(forceRefresh = false) {
  // Try cache first
  if (!forceRefresh) {
    try {
      const raw = localStorage.getItem(FX_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const age = Date.now() - new Date(cached.fetchedAt).getTime();
        if (age < ONE_DAY_MS) {
          return cached;
        }
      }
    } catch (e) { /* ignore */ }
  }

  // Fetch fresh rates from a free no-key API
  // Using exchangerate-api.com's free tier endpoint
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/GBP');
    if (!res.ok) throw new Error('FX fetch failed');
    const json = await res.json();
    if (json && json.rates) {
      const result = {
        // GBP per 1 unit of foreign currency
        GBP_per_JPY: 1 / json.rates.JPY,
        GBP_per_KRW: 1 / json.rates.KRW,
        fetchedAt: new Date().toISOString(),
      };
      try { localStorage.setItem(FX_CACHE_KEY, JSON.stringify(result)); } catch (e) {}
      return result;
    }
  } catch (e) {
    console.warn('FX fetch failed, using fallback:', e);
  }

  // Final fallback
  return {
    ...FALLBACK,
    fetchedAt: new Date().toISOString(),
    fallback: true,
  };
}

// Convert an amount in given currency to GBP
export function toGBP(amount, currency, rates) {
  if (!rates || !amount) return 0;
  if (currency === 'GBP') return amount;
  if (currency === 'JPY') return amount * rates.GBP_per_JPY;
  if (currency === 'KRW') return amount * rates.GBP_per_KRW;
  return 0;
}

export function formatGBP(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

export function formatCurrency(amount, currency) {
  if (currency === 'GBP') return formatGBP(amount);
  if (currency === 'JPY') return '¥' + Math.round(amount).toLocaleString();
  if (currency === 'KRW') return '₩' + Math.round(amount).toLocaleString();
  return amount;
}
