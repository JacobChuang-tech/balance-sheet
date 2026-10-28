import { getSettings, updateSettings, exportData, importData, clearAllData, syncFromDrive, getBackups, summarizeData } from '../store.js';
import { chooseSyncVersion } from '../components/sync-choice.js';
import { isSignedIn, getProfile, signIn, signOut } from '../gdrive.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { t, setLanguage, getDateLocale } from '../i18n.js';
import { fetchAndSaveRates } from '../rates.js';

const AVAILABLE_CURRENCIES = ['TWD', 'USD', 'EUR', 'JPY', 'GBP', 'HKD', 'CNY', 'KRW'];

const AVAILABLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh_TW', label: '繁體中文' }
];

export function render() {
  const settings = getSettings();
  const signedIn = isSignedIn();
  const profile = getProfile();

  return `
    <div class="view-header">
      <h1>${t('settings.title')}</h1>
    </div>

    <div class="card settings-section">
      <h3 class="settings-section-title">${t('settings.cloudSync')}</h3>
      <div class="settings-row">
        <div>
          <div class="settings-label">${t('settings.googleDriveSync')}</div>
          <div class="settings-description">
            ${signedIn && profile
              ? t('settings.signedInAsTemplate', profile.email)
              : t('settings.signInToSync')}
          </div>
        </div>
        ${signedIn
          ? `<button class="btn btn-secondary" id="gdrive-signout">${t('settings.signOut')}</button>`
          : `<button class="btn btn-primary" id="gdrive-signin">${t('settings.signInWithGoogle')}</button>`
        }
      </div>
      ${signedIn ? `
        <div class="settings-row">
          <div>
            <div class="settings-label">${t('settings.syncNow')}</div>
            <div class="settings-description">${t('settings.pullLatestData')}</div>
          </div>
          <button class="btn btn-secondary" id="gdrive-sync">${t('settings.sync')}</button>
        </div>
      ` : ''}
    </div>

    <div class="card settings-section">
      <h3 class="settings-section-title">${t('settings.display')}</h3>

      <div class="settings-row">
        <div>
          <div class="settings-label">${t('settings.baseCurrency')}</div>
          <div class="settings-description">${t('settings.netWorthDisplayedIn')}</div>
        </div>
        <select id="base-currency" style="width:100px;">
          ${settings.currencies.map(c => `<option value="${c}" ${c === settings.baseCurrency ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-label">${t('settings.darkMode')}</div>
          <div class="settings-description">${t('settings.switchToDarkTheme')}</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="dark-mode-toggle" ${settings.darkMode ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-label">${t('settings.language')}</div>
          <div class="settings-description">${t('settings.selectLanguage')}</div>
        </div>
        <select id="language-select" style="width:140px;">
          ${AVAILABLE_LANGUAGES.map(l => `<option value="${l.code}" ${(settings.language || 'en') === l.code ? 'selected' : ''}>${l.label}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card settings-section">
      <h3 class="settings-section-title">${t('settings.currencies')}</h3>
      <p class="settings-description" style="margin-bottom: var(--space-md);">
        ${t('settings.enableCurrenciesDescTemplate', settings.baseCurrency)}
      </p>

      <div style="margin-bottom: var(--space-md);">
        <label class="form-label">${t('settings.enabledCurrencies')}</label>
        <div style="display:flex; flex-wrap:wrap; gap:var(--space-sm); margin-top:var(--space-xs);">
          ${AVAILABLE_CURRENCIES.map(c => `
            <label style="display:flex; align-items:center; gap:var(--space-xs); cursor:pointer;">
              <input type="checkbox" class="currency-checkbox" value="${c}"
                ${settings.currencies.includes(c) ? 'checked' : ''}
                ${c === settings.baseCurrency ? 'disabled' : ''}>
              ${c}
            </label>
          `).join('')}
        </div>
      </div>

      <table class="rate-table" id="rate-table">
        <thead>
          <tr>
            <th>${t('settings.currency')}</th>
            <th>${t('settings.exchangeRateHeaderTemplate', settings.baseCurrency)}</th>
          </tr>
        </thead>
        <tbody>
          ${settings.currencies
            .filter(c => c !== settings.baseCurrency)
            .map(c => `
              <tr>
                <td>${c}</td>
                <td><input type="number" step="0.01" class="rate-input" data-currency="${c}" value="${settings.exchangeRates[c] || 1}" style="width:120px;"></td>
              </tr>
            `).join('')}
        </tbody>
      </table>
      <div style="display:flex; gap:var(--space-sm); align-items:center; flex-wrap:wrap; margin-top:var(--space-md);">
        <button class="btn btn-secondary" id="save-rates">${t('settings.saveRates')}</button>
        <button class="btn btn-primary" id="fetch-rates">${t('settings.fetchRates')}</button>
      </div>
      <p class="settings-description" style="margin-top:var(--space-sm);">
        ${settings.ratesLastFetched
          ? t('settings.ratesAutoUpdate', new Date(settings.ratesLastFetched).toLocaleDateString(getDateLocale(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
          : t('settings.ratesNeverFetched')}
      </p>
    </div>

    <div class="card settings-section">
      <h3 class="settings-section-title">${t('settings.data')}</h3>

      <div class="settings-row">
        <div>
          <div class="settings-label">${t('settings.exportData')}</div>
          <div class="settings-description">${t('settings.downloadAsJson')}</div>
        </div>
        <button class="btn btn-secondary" id="export-btn">${t('settings.export')}</button>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-label">${t('settings.importData')}</div>
          <div class="settings-description">${t('settings.restoreFromBackup')}</div>
        </div>
        <div>
          <input type="file" id="import-input" accept=".json" style="display:none;">
          <button class="btn btn-secondary" id="import-btn">${t('settings.import')}</button>
        </div>
      </div>

      ${renderBackups()}

      <div class="settings-row">
        <div>
          <div class="settings-label">${t('settings.clearAllData')}</div>
          <div class="settings-description">${t('settings.deleteAllDesc')}</div>
        </div>
        <button class="btn btn-danger" id="clear-btn">${t('settings.clear')}</button>
      </div>
    </div>
  `;
}

function renderBackups() {
  const backups = getBackups();
  if (backups.length === 0) return '';
  return `
    <div class="settings-row settings-row--stacked">
      <div>
        <div class="settings-label">${t('settings.syncBackups')}</div>
        <div class="settings-description">${t('settings.syncBackupsDesc')}</div>
      </div>
      <div class="backup-list">
        ${backups.map(b => {
          const summary = summarizeData(b.data);
          const when = new Date(b.createdAt).toLocaleString(getDateLocale(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          return `
            <div class="backup-item">
              <div>
                <div>${when} · ${t('sync.' + b.source)}</div>
                <div class="settings-description">${t('sync.summaryTemplate', summary.accounts, summary.snapshots)}</div>
              </div>
              <button class="btn btn-secondary backup-download" data-id="${b.id}">${t('settings.download')}</button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function downloadJson(json, filename) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function mount(container) {
  // Google Drive sign in/out
  const signinBtn = container.querySelector('#gdrive-signin');
  if (signinBtn) {
    signinBtn.addEventListener('click', () => signIn());
  }

  const signoutBtn = container.querySelector('#gdrive-signout');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      signOut();
      showToast(t('toast.signedOutFromGoogle'));
      window.__rerender();
    });
  }

  const syncBtn = container.querySelector('#gdrive-sync');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.textContent = t('settings.syncing');
      syncBtn.disabled = true;
      const updated = await syncFromDrive(chooseSyncVersion);
      if (updated) {
        showToast(t('toast.dataSyncedFromDrive'));
        window.__applyTheme();
        window.__rerender();
      } else {
        showToast(t('toast.alreadyUpToDate'), 'info');
        syncBtn.textContent = t('settings.sync');
        syncBtn.disabled = false;
      }
    });
  }

  // Base currency
  container.querySelector('#base-currency').addEventListener('change', (e) => {
    updateSettings({ baseCurrency: e.target.value });
    showToast(t('toast.baseCurrencyUpdated'));
    window.__rerender();
  });

  // Dark mode
  container.querySelector('#dark-mode-toggle').addEventListener('change', (e) => {
    updateSettings({ darkMode: e.target.checked });
    window.__applyTheme();
    showToast(e.target.checked ? t('toast.darkModeOn') : t('toast.darkModeOff'));
  });

  // Language selector
  container.querySelector('#language-select').addEventListener('change', (e) => {
    const lang = e.target.value;
    updateSettings({ language: lang });
    setLanguage(lang);
    window.__rerender();
  });

  // Currency checkboxes
  container.querySelectorAll('.currency-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const settings = getSettings();
      const checked = [...container.querySelectorAll('.currency-checkbox:checked')].map(c => c.value);
      // Always include base currency
      if (!checked.includes(settings.baseCurrency)) checked.unshift(settings.baseCurrency);
      updateSettings({ currencies: checked });
      window.__rerender();
    });
  });

  // Save rates
  container.querySelector('#save-rates').addEventListener('click', () => {
    const rates = {};
    container.querySelectorAll('.rate-input').forEach(input => {
      rates[input.dataset.currency] = parseFloat(input.value) || 1;
    });
    updateSettings({ exchangeRates: rates });
    showToast(t('toast.exchangeRatesSaved'));
  });

  // Fetch live rates
  container.querySelector('#fetch-rates').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.textContent = t('settings.fetchingRates');
    btn.disabled = true;
    try {
      await fetchAndSaveRates();
      showToast(t('toast.ratesFetched'));
      window.__rerender();
    } catch (err) {
      showToast(t('toast.ratesFetchFailed'), 'error');
      btn.textContent = t('settings.fetchRates');
      btn.disabled = false;
    }
  });

  // Export
  container.querySelector('#export-btn').addEventListener('click', () => {
    downloadJson(exportData(), `balance-sheet-backup-${new Date().toISOString().slice(0, 10)}.json`);
    showToast(t('toast.dataExported'));
  });

  // Download a pre-sync backup (restore it with Import)
  container.querySelectorAll('.backup-download').forEach(btn => {
    btn.addEventListener('click', () => {
      const backup = getBackups().find(b => b.id === btn.dataset.id);
      if (!backup) return;
      downloadJson(JSON.stringify(backup.data, null, 2), `balance-sheet-${backup.source}-backup-${backup.createdAt.slice(0, 10)}.json`);
    });
  });

  // Import
  const importInput = container.querySelector('#import-input');
  container.querySelector('#import-btn').addEventListener('click', () => importInput.click());

  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(reader.result);
        showToast(t('toast.dataImported'));
        window.__applyTheme();
        window.__rerender();
      } catch (err) {
        showToast(t('toast.invalidFileFormat'), 'error');
      }
    };
    reader.readAsText(file);
  });

  // Clear
  container.querySelector('#clear-btn').addEventListener('click', () => {
    const body = `
      <p>${t('settings.clearConfirm')}</p>
      <div class="form-actions" style="margin-top: var(--space-lg);">
        <button class="btn btn-secondary" id="cancel-clear">${t('accounts.cancel')}</button>
        <button class="btn btn-danger" id="confirm-clear">${t('settings.deleteEverything')}</button>
      </div>
    `;
    openModal({ title: t('settings.clearAllDataTitle'), body });

    document.getElementById('cancel-clear').addEventListener('click', closeModal);
    document.getElementById('confirm-clear').addEventListener('click', () => {
      clearAllData();
      showToast(t('toast.allDataCleared'));
      closeModal();
      window.__applyTheme();
      window.location.hash = '#/dashboard';
      window.__rerender();
    });
  });
}
