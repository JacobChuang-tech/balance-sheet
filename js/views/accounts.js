import { getAccounts, upsertAccount, deleteAccount, getSettings } from '../store.js';
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES, getCategoryInfo, getCategoryType, createAccount } from '../models.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { formatCurrency } from '../components/currency.js';

export function render() {
  const accounts = getAccounts();
  const settings = getSettings();

  const assetGroups = ASSET_CATEGORIES.map(cat => ({
    ...cat,
    accounts: accounts.filter(a => a.category === cat.key)
  })).filter(g => g.accounts.length > 0);

  const liabilityGroups = LIABILITY_CATEGORIES.map(cat => ({
    ...cat,
    accounts: accounts.filter(a => a.category === cat.key)
  })).filter(g => g.accounts.length > 0);

  const hasAccounts = accounts.length > 0;

  return `
    <div class="view-header">
      <h1>Accounts</h1>
      <button class="btn btn-primary" id="add-account-btn">+ Add Account</button>
    </div>

    ${!hasAccounts ? `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <h3>No accounts yet</h3>
        <p>Add your first account to start tracking your net worth.</p>
        <button class="btn btn-primary" id="add-account-btn-empty">+ Add Account</button>
      </div>
    ` : ''}

    ${assetGroups.length > 0 ? `
      <div class="section-label">Assets</div>
      ${assetGroups.map(group => renderGroup(group, settings)).join('')}
    ` : ''}

    ${liabilityGroups.length > 0 ? `
      <div class="section-label">Liabilities</div>
      ${liabilityGroups.map(group => renderGroup(group, settings)).join('')}
    ` : ''}
  `;
}

function renderGroup(group, settings) {
  return `
    <div class="card account-group">
      <div class="account-group-header">
        <span class="account-group-icon">${group.icon}</span>
        <span class="account-group-label">${group.label}</span>
        <span class="account-group-count">${group.accounts.length}</span>
      </div>
      <div class="account-list">
        ${group.accounts.map(acc => renderAccountItem(acc, settings)).join('')}
      </div>
    </div>
  `;
}

function renderAccountItem(acc, settings) {
  return `
    <div class="account-item" data-id="${acc.id}">
      <div class="account-item-info">
        <span class="account-item-name">${acc.name}</span>
        ${acc.note ? `<span class="account-item-note">${acc.note}</span>` : ''}
      </div>
      <div class="account-item-balance">
        <span class="account-item-amount">${formatCurrency(acc.balance, acc.currency)}</span>
        ${acc.currency !== settings.baseCurrency ? `<span class="account-item-currency">${acc.currency}</span>` : ''}
      </div>
      <div class="account-item-actions">
        <button class="btn-icon edit-account" data-id="${acc.id}" aria-label="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon delete-account" data-id="${acc.id}" aria-label="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `;
}

export function mount(container) {
  // Add account buttons
  container.querySelectorAll('#add-account-btn, #add-account-btn-empty').forEach(btn => {
    btn.addEventListener('click', () => openAccountModal());
  });

  // Edit buttons
  container.querySelectorAll('.edit-account').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const acc = getAccounts().find(a => a.id === id);
      if (acc) openAccountModal(acc);
    });
  });

  // Delete buttons
  container.querySelectorAll('.delete-account').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const acc = getAccounts().find(a => a.id === id);
      if (acc) openDeleteConfirm(acc);
    });
  });
}

function openAccountModal(existing = null) {
  const settings = getSettings();
  const isEdit = !!existing;
  const title = isEdit ? 'Edit Account' : 'Add Account';

  const allCats = [...ASSET_CATEGORIES, ...LIABILITY_CATEGORIES];

  const body = document.createElement('div');
  body.innerHTML = `
    <form id="account-form" class="form">
      <div class="form-group">
        <label class="form-label" for="acc-name">Name</label>
        <input type="text" id="acc-name" placeholder="e.g. Chase Checking" value="${existing?.name || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="acc-category">Category</label>
        <select id="acc-category">
          <optgroup label="Assets">
            ${ASSET_CATEGORIES.map(c => `<option value="${c.key}" ${existing?.category === c.key ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
          </optgroup>
          <optgroup label="Liabilities">
            ${LIABILITY_CATEGORIES.map(c => `<option value="${c.key}" ${existing?.category === c.key ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
          </optgroup>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group form-group--grow">
          <label class="form-label" for="acc-balance">Balance</label>
          <input type="number" id="acc-balance" step="0.01" placeholder="0" value="${existing?.balance || ''}" required>
        </div>
        <div class="form-group" style="width: 100px;">
          <label class="form-label" for="acc-currency">Currency</label>
          <select id="acc-currency">
            ${settings.currencies.map(c => `<option value="${c}" ${(existing?.currency || settings.baseCurrency) === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="acc-note">Note (optional)</label>
        <input type="text" id="acc-note" placeholder="Optional note" value="${existing?.note || ''}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Account'}</button>
      </div>
    </form>
  `;

  openModal({ title, body });

  // Bind form events after modal is open
  const form = document.getElementById('account-form');
  document.getElementById('cancel-btn').addEventListener('click', closeModal);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('acc-name').value.trim();
    const category = document.getElementById('acc-category').value;
    const balance = parseFloat(document.getElementById('acc-balance').value) || 0;
    const currency = document.getElementById('acc-currency').value;
    const note = document.getElementById('acc-note').value.trim();
    const type = getCategoryType(category);

    if (!name) return;

    if (isEdit) {
      upsertAccount({ ...existing, name, type, category, balance, currency, note });
      showToast('Account updated');
    } else {
      const acc = createAccount({ name, type, category, currency, balance, note });
      upsertAccount(acc);
      showToast('Account added');
    }

    closeModal();
    window.__rerender();
  });
}

function openDeleteConfirm(acc) {
  const body = `
    <p>Delete <strong>${acc.name}</strong>?</p>
    <p class="text-secondary">This won't affect past snapshots.</p>
    <div class="form-actions" style="margin-top: var(--space-lg);">
      <button class="btn btn-secondary" id="cancel-delete">Cancel</button>
      <button class="btn btn-danger" id="confirm-delete">Delete</button>
    </div>
  `;

  openModal({ title: 'Delete Account', body });

  document.getElementById('cancel-delete').addEventListener('click', closeModal);
  document.getElementById('confirm-delete').addEventListener('click', () => {
    deleteAccount(acc.id);
    showToast('Account deleted');
    closeModal();
    window.__rerender();
  });
}
