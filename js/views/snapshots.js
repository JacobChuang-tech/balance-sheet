import { getAccounts, getSnapshots, addSnapshot, deleteSnapshot, getSettings } from '../store.js';
import { createSnapshot } from '../models.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { formatCurrency } from '../components/currency.js';
import { t, getDateLocale } from '../i18n.js';
import { ICONS } from '../components/icons.js';

export function render() {
  const settings = getSettings();
  const snapshots = getSnapshots();
  const accounts = getAccounts();
  const locale = getDateLocale();

  // Check if snapshot exists for current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const hasCurrentMonth = snapshots.some(s => s.date.slice(0, 7) === currentMonth);
  const monthLabel = now.toLocaleDateString(locale, { month: 'short', year: 'numeric' });

  return `
    <div class="view-header">
      <h1>${t('snapshots.title')}</h1>
      ${accounts.length > 0 ? `
        <button class="btn btn-primary" id="take-snapshot-btn">
          ${t('snapshots.takeUpdateBtn', t(hasCurrentMonth ? 'snapshots.update' : 'snapshots.take'), monthLabel)}
        </button>
      ` : ''}
    </div>

    ${accounts.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">${ICONS.camera}</div>
        <h3>${t('snapshots.noAccountsYet')}</h3>
        <p>${t('snapshots.addAccountsFirst')}</p>
        <a href="#/accounts" class="btn btn-primary">${t('dashboard.addAccount')}</a>
      </div>
    ` : snapshots.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">${ICONS.camera}</div>
        <h3>${t('snapshots.noSnapshotsYet')}</h3>
        <p>${t('snapshots.takeFirstSnapshot')}</p>
      </div>
    ` : `
      <div class="snapshot-list">
        ${snapshots.map((snap, i) => {
          const prev = snapshots[i + 1];
          let changeHTML = '';
          if (prev) {
            const change = snap.netWorth - prev.netWorth;
            const sign = change >= 0 ? '+' : '';
            const colorClass = change >= 0 ? 'text-green' : 'text-red';
            changeHTML = `<span class="snapshot-change ${colorClass}">${sign}${formatCurrency(change, snap.baseCurrency)}</span>`;
          }

          const date = new Date(snap.date + 'T00:00:00');
          const dateStr = date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

          return `
            <div class="card snapshot-card" data-id="${snap.id}">
              <span class="snapshot-date">${dateStr}</span>
              <span class="snapshot-nw">${formatCurrency(snap.netWorth, snap.baseCurrency)}</span>
              ${changeHTML}
              <div class="snapshot-actions">
                <button class="btn-icon view-snapshot" data-id="${snap.id}" aria-label="View details">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="btn-icon delete-snapshot" data-id="${snap.id}" aria-label="${t('snapshots.deleteSnapshotTitle')}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

export function mount(container) {
  const takeBtn = container.querySelector('#take-snapshot-btn');
  if (takeBtn) {
    takeBtn.addEventListener('click', () => {
      const accounts = getAccounts();
      const settings = getSettings();
      const snapshot = createSnapshot(accounts, settings);
      addSnapshot(snapshot);
      showToast(t('toast.snapshotSaved'));
      window.__rerender();
    });
  }

  container.querySelectorAll('.view-snapshot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.dataset.id;
      const snap = getSnapshots().find(s => s.id === id);
      if (snap) showSnapshotDetail(snap);
    });
  });

  container.querySelectorAll('.delete-snapshot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.dataset.id;
      confirmDeleteSnapshot(id);
    });
  });
}

function showSnapshotDetail(snap) {
  const locale = getDateLocale();
  const date = new Date(snap.date + 'T00:00:00');
  const dateStr = date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  const assets = snap.accounts.filter(a => a.type === 'asset');
  const liabilities = snap.accounts.filter(a => a.type === 'liability');

  const body = `
    <div class="snapshot-detail-summary" style="text-align:center; margin-bottom: var(--space-lg);">
      <div class="net-worth-label">${t('snapshots.netWorth')}</div>
      <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);">
        ${formatCurrency(snap.netWorth, snap.baseCurrency)}
      </div>
      <div style="display:flex; justify-content:center; gap:var(--space-xl); margin-top:var(--space-md); font-size:var(--font-size-sm);">
        <span class="text-green">${t('snapshots.assets')}: ${formatCurrency(snap.totalAssets, snap.baseCurrency)}</span>
        <span class="text-red">${t('snapshots.liabilities')}: ${formatCurrency(snap.totalLiabilities, snap.baseCurrency)}</span>
      </div>
    </div>
    ${assets.length > 0 ? `
      <div class="section-label">${t('snapshots.assets')}</div>
      ${assets.map(a => `
        <div class="snapshot-detail-item">
          <span class="snapshot-detail-name">${a.name}</span>
          <span>${formatCurrency(a.balance, a.currency)}</span>
        </div>
      `).join('')}
    ` : ''}
    ${liabilities.length > 0 ? `
      <div class="section-label" style="margin-top:var(--space-md);">${t('snapshots.liabilities')}</div>
      ${liabilities.map(a => `
        <div class="snapshot-detail-item">
          <span class="snapshot-detail-name">${a.name}</span>
          <span class="text-red">${formatCurrency(a.balance, a.currency)}</span>
        </div>
      `).join('')}
    ` : ''}
  `;

  openModal({ title: t('snapshots.snapshotModalTitle', dateStr), body });
}

function confirmDeleteSnapshot(id) {
  const body = `
    <p>${t('snapshots.deleteConfirm')}</p>
    <div class="form-actions" style="margin-top: var(--space-lg);">
      <button class="btn btn-secondary" id="cancel-del-snap">${t('accounts.cancel')}</button>
      <button class="btn btn-danger" id="confirm-del-snap">${t('accounts.delete')}</button>
    </div>
  `;

  openModal({ title: t('snapshots.deleteSnapshotTitle'), body });

  document.getElementById('cancel-del-snap').addEventListener('click', closeModal);
  document.getElementById('confirm-del-snap').addEventListener('click', () => {
    deleteSnapshot(id);
    showToast(t('toast.snapshotDeleted'));
    closeModal();
    window.__rerender();
  });
}
