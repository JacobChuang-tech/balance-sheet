/**
 * Auto-fetch exchange rates from frankfurter.app (free, no API key).
 *
 * Strategy — "effortless":
 *   • On app load, check if rates are older than 24 hours.
 *   • If stale, fetch fresh rates silently in the background.
 *   • User can also trigger a manual fetch from Settings.
 *   • Rates are stored in settings.exchangeRates + settings.ratesLastFetched.
 */

import { getSettings, updateSettings } from './store.js';

const API_BASE = 'https://api.frankfurter.app';
const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch live exchange rates for all enabled currencies relative to baseCurrency.
 * Returns an object like { USD: 0.031, JPY: 4.72, ... } (value of 1 foreign unit in base).
 *
 * frankfurter gives "1 BASE = X FOREIGN", but the app stores
 * "1 FOREIGN = X BASE" (i.e. how much base you get for 1 unit of foreign).
 * So we invert the rates.
 */
export async function fetchRates() {
  const settings = getSettings();
  const base = settings.baseCurrency;
  const others = settings.currencies.filter(c => c !== base);

  if (others.length === 0) return null;

  const symbols = others.join(',');
  const url = `${API_BASE}/latest?from=${base}&to=${symbols}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`);

  const data = await res.json();
  // data.rates = { USD: 0.031, JPY: 4.72, ... }  (1 BASE = X FOREIGN)
  // We need the inverse: 1 FOREIGN = X BASE
  const rates = {};
  for (const [currency, fwdRate] of Object.entries(data.rates)) {
    rates[currency] = fwdRate > 0 ? +(1 / fwdRate).toFixed(6) : 1;
  }

  return rates;
}

/**
 * Fetch and persist rates into settings. Returns true if updated.
 */
export async function fetchAndSaveRates() {
  const rates = await fetchRates();
  if (!rates) return false;

  const settings = getSettings();
  // Merge: keep any manually-set rates for currencies not returned by API
  const merged = { ...settings.exchangeRates, ...rates };

  updateSettings({
    exchangeRates: merged,
    ratesLastFetched: Date.now()
  });

  return true;
}

/**
 * Silently refresh rates if stale (>24h). Called once on app boot.
 */
export async function autoRefreshIfStale() {
  const settings = getSettings();
  const last = settings.ratesLastFetched || 0;
  const age = Date.now() - last;

  if (age < STALE_MS) return false; // still fresh

  try {
    return await fetchAndSaveRates();
  } catch (e) {
    console.warn('Auto rate refresh failed (will retry next load):', e.message);
    return false;
  }
}
