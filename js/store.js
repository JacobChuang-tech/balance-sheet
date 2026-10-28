import { isSignedIn, saveToDrive, loadFromDrive } from './gdrive.js';

const STORAGE_KEY = 'balancesheet_data';

const DEFAULT_DATA = {
  version: 1,
  settings: {
    baseCurrency: 'TWD',
    currencies: ['TWD', 'USD'],
    exchangeRates: { USD: 32.15 },
    darkMode: false,
    language: 'en'
  },
  accounts: [],
  snapshots: [],
  transactions: []
};

let _data = null;
let _syncTimer = null;

function loadData() {
  if (_data) return _data;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _data = raw ? JSON.parse(raw) : structuredClone(DEFAULT_DATA);
  } catch {
    _data = structuredClone(DEFAULT_DATA);
  }
  return _data;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
  scheduleDriveSync();
}

// Debounced sync — waits 2s after last change, then pushes to Drive
function scheduleDriveSync() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    if (isSignedIn()) {
      saveToDrive(loadData()).catch(e => console.warn('Drive sync failed:', e));
    }
  }, 2000);
}

// Pull data from Drive (called after sign-in)
export async function syncFromDrive() {
  if (!isSignedIn()) return false;
  try {
    const driveData = await loadFromDrive();
    if (!driveData) {
      // No data on Drive yet — push local data up
      await saveToDrive(loadData());
      return false;
    }
    // Merge strategy: Drive wins (latest cloud version)
    _data = driveData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
    return true; // data was updated from Drive
  } catch (e) {
    console.warn('Failed to sync from Drive:', e);
    return false;
  }
}

// Accounts
export function getAccounts() {
  return loadData().accounts;
}

export function getAccountById(id) {
  return getAccounts().find(a => a.id === id) || null;
}

export function upsertAccount(account) {
  const data = loadData();
  const idx = data.accounts.findIndex(a => a.id === account.id);
  if (idx >= 0) {
    data.accounts[idx] = { ...data.accounts[idx], ...account, updatedAt: new Date().toISOString() };
  } else {
    data.accounts.push(account);
  }
  saveData();
  return data.accounts[idx >= 0 ? idx : data.accounts.length - 1];
}

export function deleteAccount(id) {
  const data = loadData();
  data.accounts = data.accounts.filter(a => a.id !== id);
  saveData();
}

export function getAccountsByType(type) {
  return getAccounts().filter(a => a.type === type);
}

export function getAccountsByCategory(category) {
  return getAccounts().filter(a => a.category === category);
}

// Snapshots
export function getSnapshots() {
  return loadData().snapshots.sort((a, b) => b.date.localeCompare(a.date));
}

export function addSnapshot(snapshot) {
  const data = loadData();
  // Remove existing snapshot for same month
  data.snapshots = data.snapshots.filter(s => s.date.slice(0, 7) !== snapshot.date.slice(0, 7));
  data.snapshots.push(snapshot);
  saveData();
  return snapshot;
}

export function deleteSnapshot(id) {
  const data = loadData();
  data.snapshots = data.snapshots.filter(s => s.id !== id);
  saveData();
}

// Transactions
export function getTransactions() {
  const data = loadData();
  if (!data.transactions) data.transactions = [];
  return data.transactions;
}

export function getTransactionsByMonth(yearMonth) {
  return getTransactions().filter(t => t.date.startsWith(yearMonth));
}

export function upsertTransaction(transaction) {
  const data = loadData();
  if (!data.transactions) data.transactions = [];
  const idx = data.transactions.findIndex(t => t.id === transaction.id);
  if (idx >= 0) {
    data.transactions[idx] = { ...data.transactions[idx], ...transaction, updatedAt: new Date().toISOString() };
  } else {
    data.transactions.push(transaction);
  }
  saveData();
  return data.transactions[idx >= 0 ? idx : data.transactions.length - 1];
}

export function deleteTransaction(id) {
  const data = loadData();
  if (!data.transactions) data.transactions = [];
  data.transactions = data.transactions.filter(t => t.id !== id);
  saveData();
}

export function calculateMonthlyPnl(yearMonth) {
  const settings = getSettings();
  const txns = getTransactionsByMonth(yearMonth);
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const txn of txns) {
    const inBase = convertToBase(txn.amount, txn.currency, settings);
    if (txn.type === 'income') {
      totalIncome += inBase;
    } else {
      totalExpenses += inBase;
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses
  };
}

// Settings
export function getSettings() {
  return loadData().settings;
}

export function updateSettings(partial) {
  const data = loadData();
  data.settings = { ...data.settings, ...partial };
  saveData();
  return data.settings;
}

// Export / Import
export function exportData() {
  return JSON.stringify(loadData(), null, 2);
}

export function importData(json) {
  const parsed = JSON.parse(json);
  if (!parsed.version || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.snapshots)) {
    throw new Error('Invalid data format');
  }
  if (!Array.isArray(parsed.transactions)) parsed.transactions = [];
  _data = parsed;
  saveData();
  return _data;
}

export function clearAllData() {
  _data = structuredClone(DEFAULT_DATA);
  saveData();
}

// Calculations
export function calculateNetWorth() {
  const accounts = getAccounts();
  const settings = getSettings();
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const acc of accounts) {
    const inBase = convertToBase(acc.balance, acc.currency, settings);
    if (acc.type === 'asset') {
      totalAssets += inBase;
    } else {
      totalLiabilities += inBase;
    }
  }

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities
  };
}

export function convertToBase(amount, fromCurrency, settings) {
  if (fromCurrency === settings.baseCurrency) return amount;
  const rate = settings.exchangeRates[fromCurrency];
  if (!rate) return amount; // fallback: treat as 1:1
  return amount * rate;
}
