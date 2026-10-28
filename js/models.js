import { t } from './i18n.js';

export const ASSET_CATEGORIES = [
  { key: 'cash', label: 'Cash & Bank', icon: 'bank', color: 'var(--color-cash)' },
  { key: 'investments', label: 'Investments', icon: 'trend', color: 'var(--color-investments)' },
  { key: 'fixed_assets', label: 'Fixed Assets', icon: 'home', color: 'var(--color-fixed-assets)' },
  { key: 'receivables', label: 'Receivables', icon: 'clipboard', color: 'var(--color-receivables)' },
  { key: 'other_assets', label: 'Other Assets', icon: 'gem', color: 'var(--color-other-assets)' }
];

export const LIABILITY_CATEGORIES = [
  { key: 'credit_cards', label: 'Credit Cards', icon: 'creditCard', color: 'var(--color-credit-cards)' },
  { key: 'loans', label: 'Loans', icon: 'bank', color: 'var(--color-loans)' },
  { key: 'other_liabilities', label: 'Other Liabilities', icon: 'fileText', color: 'var(--color-other-liabilities)' }
];

export const ALL_CATEGORIES = [...ASSET_CATEGORIES, ...LIABILITY_CATEGORIES];

export function getCategoryInfo(key) {
  const cat = ALL_CATEGORIES.find(c => c.key === key) || { key, icon: 'package', color: 'var(--color-text-muted)' };
  return { ...cat, label: t('category.' + key) || cat.label || key };
}

// Four summary tiers. Receivables and other assets roll into investments
// so the tiers always add up to net worth.
export const TIERS = [
  { key: 'cash', color: '#2f8f5b' },
  { key: 'investments', color: '#0071e3' },
  { key: 'personal', color: '#af52de' },
  { key: 'liabilities', color: '#c8553d' }
];

export function getTier(categoryKey) {
  if (categoryKey === 'cash') return 'cash';
  if (categoryKey === 'fixed_assets') return 'personal';
  if (getCategoryType(categoryKey) === 'liability') return 'liabilities';
  return 'investments';
}

// Only cash and investment tiers can be locked (e.g. time deposits, pension, restricted stock)
export function canBeLocked(categoryKey) {
  const tier = getTier(categoryKey);
  return tier === 'cash' || tier === 'investments';
}

// Liability term; accounts created before this field existed default by category
export function getAccountTerm(acc) {
  if (acc.term === 'short' || acc.term === 'long') return acc.term;
  return acc.category === 'loans' ? 'long' : 'short';
}

export function isAccountLocked(acc) {
  return canBeLocked(acc.category) && !!acc.locked;
}

// items: [{ category, amountInBase, locked, term }]
// Liquid net worth = unlocked cash + unlocked investments − short-term liabilities
export function computeTierTotals(items) {
  const totals = { cash: 0, investments: 0, personal: 0, liabilities: 0, shortTerm: 0, longTerm: 0, locked: 0 };
  for (const item of items) {
    const tier = getTier(item.category);
    totals[tier] += item.amountInBase;
    if (tier === 'liabilities') {
      totals[getAccountTerm(item) === 'long' ? 'longTerm' : 'shortTerm'] += item.amountInBase;
    } else if (isAccountLocked(item)) {
      totals.locked += item.amountInBase;
    }
  }
  totals.liquidNetWorth = totals.cash + totals.investments - totals.locked - totals.shortTerm;
  return totals;
}

// Snapshots taken before term/locked were recorded borrow them from the current
// account with the same id (or the category default); those totals are flagged as estimated.
export function getSnapshotTierTotals(snapshot, currentAccounts = []) {
  let estimated = false;
  const items = snapshot.accounts.map(a => {
    let { term, locked } = a;
    if (locked === undefined || term === undefined) {
      estimated = true;
      const current = currentAccounts.find(c => c.id === a.accountId) || {};
      if (term === undefined) term = current.term;
      if (locked === undefined) locked = current.locked;
    }
    return { category: a.category, amountInBase: a.balanceInBase, term, locked };
  });
  return { ...computeTierTotals(items), estimated };
}

export function getCategoryType(categoryKey) {
  if (ASSET_CATEGORIES.some(c => c.key === categoryKey)) return 'asset';
  if (LIABILITY_CATEGORIES.some(c => c.key === categoryKey)) return 'liability';
  return 'asset';
}

export function createAccount({ name, type, category, currency, balance, note = '', term, locked = false }) {
  const now = new Date().toISOString();
  return {
    id: 'acc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name,
    type,
    category,
    currency,
    balance: parseFloat(balance) || 0,
    note,
    term: type === 'liability' ? (term || getAccountTerm({ category })) : undefined,
    locked: canBeLocked(category) ? !!locked : false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function createSnapshot(accounts, settings) {
  const now = new Date();
  // Local calendar date (YYYY-MM-DD) the snapshot was taken
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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
      balanceInBase,
      term: acc.type === 'liability' ? getAccountTerm(acc) : null,
      locked: isAccountLocked(acc)
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

// Income & Expense categories
export const INCOME_CATEGORIES = [
  { key: 'salary', label: 'Salary', icon: 'briefcase', color: '#2f8f5b' },
  { key: 'freelance', label: 'Freelance', icon: 'laptop', color: '#3e9f6c' },
  { key: 'investment_income', label: 'Investment Income', icon: 'percent', color: '#4fae7d' },
  { key: 'gifts_received', label: 'Gifts Received', icon: 'gift', color: '#60bd8e' },
  { key: 'other_income', label: 'Other Income', icon: 'banknote', color: '#71cc9f' }
];

export const EXPENSE_CATEGORIES = [
  { key: 'housing', label: 'Housing', icon: 'home', color: 'var(--color-expense)' },
  { key: 'food', label: 'Food & Dining', icon: 'utensils', color: 'var(--color-expense)' },
  { key: 'transportation', label: 'Transportation', icon: 'car', color: 'var(--color-expense)' },
  { key: 'shopping', label: 'Shopping', icon: 'bag', color: 'var(--color-expense)' },
  { key: 'entertainment', label: 'Entertainment', icon: 'film', color: 'var(--color-expense)' },
  { key: 'healthcare', label: 'Healthcare', icon: 'heartPulse', color: 'var(--color-expense)' },
  { key: 'education', label: 'Education', icon: 'book', color: 'var(--color-expense)' },
  { key: 'utilities', label: 'Utilities', icon: 'bolt', color: 'var(--color-expense)' },
  { key: 'insurance', label: 'Insurance', icon: 'shield', color: 'var(--color-expense)' },
  { key: 'other_expense', label: 'Other Expense', icon: 'package', color: 'var(--color-expense)' }
];

export const ALL_PNL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export function getPnlCategoryInfo(key) {
  const cat = ALL_PNL_CATEGORIES.find(c => c.key === key) || { key, icon: 'package', color: 'var(--color-text-muted)' };
  return { ...cat, label: t('category.' + key) || cat.label || key };
}

export function createTransaction({ type, category, amount, currency, description = '', date }) {
  const now = new Date().toISOString();
  return {
    id: 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    type,
    category,
    amount: parseFloat(amount) || 0,
    currency,
    description,
    date,
    createdAt: now,
    updatedAt: now
  };
}

export function validateImport(data) {
  if (!data || typeof data !== 'object') return false;
  if (!data.version || !Array.isArray(data.accounts) || !Array.isArray(data.snapshots)) return false;
  if (!data.settings || !data.settings.baseCurrency) return false;
  return true;
}
