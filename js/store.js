import { isSignedIn, saveToDrive, loadFromDrive, signOut } from './gdrive.js';

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

// Backups of data that a sync was about to overwrite (newest first)
const BACKUP_KEY = 'balancesheet_backups';
const MAX_BACKUPS = 5;

export function getBackups() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_KEY)) || [];
  } catch {
    return [];
  }
}

function addBackup(source, data) {
  const backups = getBackups();
  backups.unshift({ id: 'bak_' + Date.now(), source, createdAt: new Date().toISOString(), data });
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, MAX_BACKUPS)));
}

function hasContent(data) {
  return !!(data.accounts?.length || data.snapshots?.length || data.transactions?.length);
}

export function summarizeData(data) {
  const stamps = [
    ...(data.accounts || []).map(a => a.updatedAt),
    ...(data.snapshots || []).map(s => s.createdAt),
    ...(data.transactions || []).map(t => t.updatedAt)
  ].filter(Boolean).sort();
  const snapshotDates = (data.snapshots || []).map(s => s.date).sort();
  return {
    accounts: (data.accounts || []).length,
    snapshots: snapshotDates.length,
    latestSnapshot: snapshotDates[snapshotDates.length - 1] || null,
    lastUpdated: stamps[stamps.length - 1] || null
  };
}

// Pull data from Drive (called after sign-in). When both sides have different data,
// chooseVersion(localSummary, driveSummary) resolves to 'local', 'drive' or null (cancel).
// Whichever side gets replaced is backed up first. Returns true if local data changed.
export async function syncFromDrive(chooseVersion) {
  if (!isSignedIn()) return false;
  // Don't let a pending auto-sync push local data before the user has chosen
  if (_syncTimer) clearTimeout(_syncTimer);
  try {
    const local = loadData();
    const driveData = await loadFromDrive();
    if (!driveData || !hasContent(driveData)) {
      await saveToDrive(local);
      return false;
    }
    if (JSON.stringify(driveData) === JSON.stringify(local)) return false;

    let choice = 'drive';
    if (hasContent(local)) {
      choice = await chooseVersion(summarizeData(local), summarizeData(driveData));
    }

    if (choice === 'drive') {
      if (hasContent(local)) addBackup('local', local);
      _data = driveData;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
      return true;
    }
    if (choice === 'local') {
      addBackup('drive', driveData);
      await saveToDrive(local);
      return false;
    }
    // Cancelled: sign out so later edits don't silently overwrite Drive
    signOut();
    return false;
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
