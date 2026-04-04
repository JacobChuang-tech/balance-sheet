export const ASSET_CATEGORIES = [
  { key: 'cash', label: 'Cash & Bank', icon: '🏦' },
  { key: 'investments', label: 'Investments', icon: '📈' },
  { key: 'fixed_assets', label: 'Fixed Assets', icon: '🏠' },
  { key: 'receivables', label: 'Receivables', icon: '📋' },
  { key: 'other_assets', label: 'Other Assets', icon: '💎' }
];

export const LIABILITY_CATEGORIES = [
  { key: 'credit_cards', label: 'Credit Cards', icon: '💳' },
  { key: 'loans', label: 'Loans', icon: '🏦' },
  { key: 'other_liabilities', label: 'Other Liabilities', icon: '📄' }
];

export const ALL_CATEGORIES = [...ASSET_CATEGORIES, ...LIABILITY_CATEGORIES];

export function getCategoryInfo(key) {
  return ALL_CATEGORIES.find(c => c.key === key) || { key, label: key, icon: '📦' };
}

export function getCategoryType(categoryKey) {
  if (ASSET_CATEGORIES.some(c => c.key === categoryKey)) return 'asset';
  if (LIABILITY_CATEGORIES.some(c => c.key === categoryKey)) return 'liability';
  return 'asset';
}

export function createAccount({ name, type, category, currency, balance, note = '' }) {
  const now = new Date().toISOString();
  return {
    id: 'acc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name,
    type,
    category,
    currency,
    balance: parseFloat(balance) || 0,
    note,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function createSnapshot(accounts, settings) {
  const now = new Date();
  const date = now.toISOString().slice(0, 7) + '-01'; // First of month

  let totalAssets = 0;
  let totalLiabilities = 0;

  const snapshotAccounts = accounts.map(acc => {
    let balanceInBase = acc.balance;
    if (acc.currency !== settings.baseCurrency) {
      const rate = settings.exchangeRates[acc.currency];
      if (rate) balanceInBase = acc.balance * rate;
    }

    if (acc.type === 'asset') totalAssets += balanceInBase;
    else totalLiabilities += balanceInBase;

    return {
      accountId: acc.id,
      name: acc.name,
      type: acc.type,
      category: acc.category,
      currency: acc.currency,
      balance: acc.balance,
      balanceInBase
    };
  });

  return {
    id: 'snap_' + Date.now(),
    date,
    baseCurrency: settings.baseCurrency,
    exchangeRates: { ...settings.exchangeRates },
    accounts: snapshotAccounts,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    createdAt: now.toISOString()
  };
}

export function validateImport(data) {
  if (!data || typeof data !== 'object') return false;
  if (!data.version || !Array.isArray(data.accounts) || !Array.isArray(data.snapshots)) return false;
  if (!data.settings || !data.settings.baseCurrency) return false;
  return true;
}
