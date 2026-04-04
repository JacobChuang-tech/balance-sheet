import { getSettings, convertToBase } from '../store.js';

const CURRENCY_SYMBOLS = {
  TWD: 'NT$',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  GBP: '£',
  HKD: 'HK$',
  CNY: '¥',
  KRW: '₩'
};

export function getCurrencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || code;
}

export function formatCurrency(amount, currencyCode) {
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

export function formatCurrencyFull(amount, currencyCode) {
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

export function formatInBase(amount, fromCurrency) {
  const settings = getSettings();
  const inBase = convertToBase(amount, fromCurrency, settings);
  return formatCurrency(inBase, settings.baseCurrency);
}
