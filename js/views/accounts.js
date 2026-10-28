import { getAccounts, upsertAccount, deleteAccount, getSettings } from '../store.js';
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES, getCategoryInfo, getCategoryType, createAccount, canBeLocked, getAccountTerm } from '../models.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { formatCurrency } from '../components/currency.js';
import { t } from '../i18n.js';
import { ICONS, categoryTile } from '../components/icons.js';

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
      <h1>${t('accounts.title')}</h1>
      <button class="btn btn-primary" id="add-account-btn">${t('accounts.addAccount')}</button>
    </div>

    ${!hasAccounts ? `
      <div class="empty-state">
        <div class="empty-state-icon">${ICONS.wallet}</div>
        <h3>${t('accounts.noAccountsYet')}</h3>
        <p>${t('accounts.addFirstAccount')}</p>
        <button class="btn btn-primary" id="add-account-btn-empty">${t('accounts.addAccount')}</button>
      </div>
    ` : ''}

    ${assetGroups.length > 0 ? `
      <div class="section-label">${t('accounts.assets')}</div>
      ${assetGroups.map(group => renderGroup(group, settings)).join('')}
    ` : ''}

    ${liabilityGroups.length > 0 ? `
      <div class="section-label">${t('accounts.liabilities')}</div>
      ${liabilityGroups.map(group => renderGroup(group, settings)).join('')}
    ` : ''}
  `;
}

function renderGroup(group, settings) {
  return `
    <div class="card account-group">
      <div class="account-group-header">
        <span class="account-group-icon">${categoryTile(group)}</span>
        <span class="account-group-label">${t('category.' + group.key)}</span>
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
        ${acc.type === 'liability' ? `<span class="account-item-badge">${t(getAccountTerm(acc) === 'long' ? 'accounts.termLong' : 'accounts.termShort')}</span>` : ''}
        ${canBeLocked(acc.category) && acc.locked ? `<span class="account-item-badge">${t('accounts.locked')}</span>` : ''}
      </div>
      <div class="account-item-balance">
        <span class="account-item-amount">${formatCurrency(acc.balance, acc.currency)}</span>
        ${acc.currency !== settings.baseCurrency ? `<span class="account-item-currency">${acc.currency}</span>` : ''}
      </div>
      <div class="account-item-actions">
        <button class="btn-icon edit-account" data-id="${acc.id}" aria-label="${t('accounts.editAccountTitle')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon delete-account" data-id="${acc.id}" aria-label="${t('accounts.deleteAccountTitle')}">
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
  const title = isEdit ? t('accounts.editAccountTitle') : t('accounts.addAccountTitle');

  const body = document.createElement('div');
  body.innerHTML = `
    <form id="account-form" class="form">
      <div class="form-group">
        <label class="form-label" for="acc-name">${t('accounts.name')}</label>
        <input type="text" id="acc-name" placeholder="${t('accounts.namePlaceholder')}" value="${existing?.name || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="acc-category">${t('accounts.category')}</label>
        <select id="acc-category">
          <optgroup label="${t('catgroup.assets')}">
            ${ASSET_CATEGORIES.map(c => `<option value="${c.key}" ${existing?.category === c.key ? 'selected' : ''}>${t('category.' + c.key)}</option>`).join('')}
          </optgroup>
          <optgroup label="${t('catgroup.liabilities')}">
            ${LIABILITY_CATEGORIES.map(c => `<option value="${c.key}" ${existing?.category === c.key ? 'selected' : ''}>${t('category.' + c.key)}</option>`).join('')}
          </optgroup>
        </select>
        <p class="form-hint" id="acc-personal-hint">${t('accounts.personalUseHint')}</p>
      </div>
      <div class="form-group" id="acc-term-group">
        <label class="form-label" for="acc-term">${t('accounts.term')}</label>
        <select id="acc-term">
          <option value="short">${t('accounts.termShort')}</option>
          <option value="long">${t('accounts.termLong')}</option>
        </select>
      </div>
      <label class="form-check" id="acc-locked-group">
        <input type="checkbox" id="acc-locked" ${existing?.locked ? 'checked' : ''}>
        <span>
          <span class="form-check-label">${t('accounts.locked')}</span>
          <span class="form-hint">${t('accounts.lockedHint')}</span>
        </span>
      </label>
      <div class="form-row">
        <div class="form-group form-group--grow">
          <label class="form-label" for="acc-balance">${t('accounts.balance')}</label>
          <input type="number" id="acc-balance" step="0.01" placeholder="0" value="${existing?.balance || ''}" required>
        </div>
        <div class="form-group" style="width: 100px;">
          <label class="form-label" for="acc-currency">${t('accounts.currency')}</label>
          <select id="acc-currency">
            ${settings.currencies.map(c => `<option value="${c}" ${(existing?.currency || settings.baseCurrency) === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="acc-note">${t('accounts.noteOptional')}</label>
        <input type="text" id="acc-note" placeholder="${t('accounts.notePlaceholder')}" value="${existing?.note || ''}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="cancel-btn">${t('accounts.cancel')}</button>
        <button type="submit" class="btn btn-primary">${isEdit ? t('accounts.saveChanges') : t('accounts.addAccountTitle')}</button>
      </div>
    </form>
  `;

  openModal({ title, body });

  // Bind form events after modal is open
  const form = document.getElementById('account-form');
  document.getElementById('cancel-btn').addEventListener('click', closeModal);

  // Show only the fields that apply to the selected category
  const categorySelect = document.getElementById('acc-category');
  const termSelect = document.getElementById('acc-term');
  let termTouched = !!existing?.term;
  termSelect.value = getAccountTerm(existing || { category: categorySelect.value });
  termSelect.addEventListener('change', () => { termTouched = true; });
  const syncCategoryFields = () => {
    const category = categorySelect.value;
    document.getElementById('acc-personal-hint').hidden = category !== 'fixed_assets';
    document.getElementById('acc-term-group').hidden = getCategoryType(category) !== 'liability';
    document.getElementById('acc-locked-group').hidden = !canBeLocked(category);
    if (!termTouched) termSelect.value = getAccountTerm({ category });
  };
  categorySelect.addEventListener('change', syncCategoryFields);
  syncCategoryFields();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('acc-name').value.trim();
    const category = document.getElementById('acc-category').value;
    const balance = parseFloat(document.getElementById('acc-balance').value) || 0;
    const currency = document.getElementById('acc-currency').value;
    const note = document.getElementById('acc-note').value.trim();
    const type = getCategoryType(category);
    const term = type === 'liability' ? termSelect.value : undefined;
    const locked = canBeLocked(category) && document.getElementById('acc-locked').checked;

    if (!name) return;

    if (isEdit) {
      upsertAccount({ ...existing, name, type, category, balance, currency, note, term, locked });
      showToast(t('toast.accountUpdated'));
    } else {
      const acc = createAccount({ name, type, category, currency, balance, note, term, locked });
      upsertAccount(acc);
      showToast(t('toast.accountAdded'));
    }

    closeModal();
    window.__rerender();
  });
}

function openDeleteConfirm(acc) {
  const body = `
    <p>${t('accounts.deleteConfirmBody', acc.name)}</p>
    <p class="text-secondary">${t('accounts.deleteConfirmDesc')}</p>
    <div class="form-actions" style="margin-top: var(--space-lg);">
      <button class="btn btn-secondary" id="cancel-delete">${t('accounts.cancel')}</button>
      <button class="btn btn-danger" id="confirm-delete">${t('accounts.delete')}</button>
    </div>
  `;

  openModal({ title: t('accounts.deleteAccountTitle'), body });

  document.getElementById('cancel-delete').addEventListener('click', closeModal);
  document.getElementById('confirm-delete').addEventListener('click', () => {
    deleteAccount(acc.id);
    showToast(t('toast.accountDeleted'));
    closeModal();
    window.__rerender();
  });
}
