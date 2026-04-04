import { isSignedIn, saveToDrive, loadFromDrive } from './gdrive.js';

const STORAGE_KEY = 'balancesheet_data';

const DEFAULT_DATA = {
  version: 1,
  settings: {
    baseCurrency: 'TWD',
    currencies: ['TWD', 'USD'],
    exchangeRates: { USD: 32.15 },
    darkMode: false
  },
  accounts: [],
  snapshots: []
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
  data.snapshots = data.snapshots.filter(s => s.date !== snapshot.date);
  data.snapshots.push(snapshot);
  saveData();
  return snapshot;
}

export function deleteSnapshot(id) {
  const data = loadData();
  data.snapshots = data.snapshots.filter(s => s.id !== id);
  saveData();
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
