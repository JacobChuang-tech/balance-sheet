import { getSettings, updateSettings, exportData, importData, clearAllData, syncFromDrive } from '../store.js';
import { isSignedIn, getProfile, signIn, signOut } from '../gdrive.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const AVAILABLE_CURRENCIES = ['TWD', 'USD', 'EUR', 'JPY', 'GBP', 'HKD', 'CNY', 'KRW'];

export function render() {
  const settings = getSettings();
  const signedIn = isSignedIn();
  const profile = getProfile();

  return `
    <div class="view-header">
      <h1>Settings</h1>
    </div>

    <div class="card settings-section">
      <h3 class="settings-section-title">Cloud Sync</h3>
      <div class="settings-row">
        <div>
          <div class="settings-label">Google Drive Sync</div>
          <div class="settings-description">
            ${signedIn && profile
              ? `Signed in as ${profile.email}. Data syncs automatically.`
              : 'Sign in to sync data across devices via Google Drive.'}
          </div>
        </div>
        ${signedIn
          ? `<button class="btn btn-secondary" id="gdrive-signout">Sign Out</button>`
          : `<button class="btn btn-primary" id="gdrive-signin">Sign in with Google</button>`
        }
      </div>
      ${signedIn ? `
        <div class="settings-row">
          <div>
            <div class="settings-label">Sync Now</div>
            <div class="settings-description">Pull latest data from Google Drive</div>
          </div>
          <button class="btn btn-secondary" id="gdrive-sync">Sync</button>
        </div>
      ` : ''}
    </div>

    <div class="card settings-section">
      <h3 class="settings-section-title">Display</h3>

      <div class="settings-row">
        <div>
          <div class="settings-label">Base Currency</div>
          <div class="settings-description">Net worth displayed in this currency</div>
        </div>
        <select id="base-currency" style="width:100px;">
          ${settings.currencies.map(c => `<option value="${c}" ${c === settings.baseCurrency ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-label">Dark Mode</div>
          <div class="settings-description">Switch to dark theme</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="dark-mode-toggle" ${settings.darkMode ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
      </div>
    </div>

    <div class="card settings-section">
      <h3 class="settings-section-title">Currencies</h3>
      <p class="settings-description" style="margin-bottom: var(--space-md);">
        Enable currencies and set exchange rates relative to ${settings.baseCurrency}.
      </p>

      <div style="margin-bottom: var(--space-md);">
        <label class="form-label">Enabled Currencies</label>
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
            <th>Currency</th>
            <th>1 unit = ? ${settings.baseCurrency}</th>
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
      <button class="btn btn-secondary" id="save-rates" style="margin-top:var(--space-md);">Save Rates</button>
    </div>

    <div class="card settings-section">
      <h3 class="settings-section-title">Data</h3>

      <div class="settings-row">
        <div>
          <div class="settings-label">Export Data</div>
          <div class="settings-description">Download all data as JSON file</div>
        </div>
        <button class="btn btn-secondary" id="export-btn">Export</button>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-label">Import Data</div>
          <div class="settings-description">Restore from a JSON backup (replaces current data)</div>
        </div>
        <div>
          <input type="file" id="import-input" accept=".json" style="display:none;">
          <button class="btn btn-secondary" id="import-btn">Import</button>
        </div>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-label">Clear All Data</div>
          <div class="settings-description">Delete all accounts, snapshots, and settings</div>
        </div>
        <button class="btn btn-danger" id="clear-btn">Clear</button>
      </div>
    </div>
  `;
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
      showToast('Signed out from Google Drive');
      window.__rerender();
    });
  }

  const syncBtn = container.querySelector('#gdrive-sync');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.textContent = 'Syncing...';
      syncBtn.disabled = true;
      const updated = await syncFromDrive();
      if (updated) {
        showToast('Data synced from Google Drive');
        window.__applyTheme();
        window.__rerender();
      } else {
        showToast('Already up to date', 'info');
        syncBtn.textContent = 'Sync';
        syncBtn.disabled = false;
      }
    });
  }

  // Base currency
  container.querySelector('#base-currency').addEventListener('change', (e) => {
    updateSettings({ baseCurrency: e.target.value });
    showToast('Base currency updated');
    window.__rerender();
  });

  // Dark mode
  container.querySelector('#dark-mode-toggle').addEventListener('change', (e) => {
    updateSettings({ darkMode: e.target.checked });
    window.__applyTheme();
    showToast(e.target.checked ? 'Dark mode on' : 'Dark mode off');
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
    showToast('Exchange rates saved');
  });

  // Export
  container.querySelector('#export-btn').addEventListener('click', () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-sheet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported');
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
        showToast('Data imported successfully');
        window.__applyTheme();
        window.__rerender();
      } catch (err) {
        showToast('Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
  });

  // Clear
  container.querySelector('#clear-btn').addEventListener('click', () => {
    const body = `
      <p>This will permanently delete all accounts, snapshots, and settings. Are you sure?</p>
      <div class="form-actions" style="margin-top: var(--space-lg);">
        <button class="btn btn-secondary" id="cancel-clear">Cancel</button>
        <button class="btn btn-danger" id="confirm-clear">Delete Everything</button>
      </div>
    `;
    openModal({ title: 'Clear All Data', body });

    document.getElementById('cancel-clear').addEventListener('click', closeModal);
    document.getElementById('confirm-clear').addEventListener('click', () => {
      clearAllData();
      showToast('All data cleared');
      closeModal();
      window.__applyTheme();
      window.location.hash = '#/dashboard';
      window.__rerender();
    });
  });
}
