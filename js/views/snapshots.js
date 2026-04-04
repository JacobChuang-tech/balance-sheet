import { getAccounts, getSnapshots, addSnapshot, deleteSnapshot, getSettings } from '../store.js';
import { createSnapshot } from '../models.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { formatCurrency } from '../components/currency.js';

export function render() {
  const settings = getSettings();
  const snapshots = getSnapshots();
  const accounts = getAccounts();

  // Check if snapshot exists for current month
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7) + '-01';
  const hasCurrentMonth = snapshots.some(s => s.date === currentMonth);

  return `
    <div class="view-header">
      <h1>Snapshots</h1>
      ${accounts.length > 0 ? `
        <button class="btn btn-primary" id="take-snapshot-btn">
          ${hasCurrentMonth ? 'Update' : 'Take'} ${now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} Snapshot
        </button>
      ` : ''}
    </div>

    ${accounts.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">📸</div>
        <h3>No accounts yet</h3>
        <p>Add accounts first, then take monthly snapshots to track your net worth over time.</p>
        <a href="#/accounts" class="btn btn-primary">+ Add Account</a>
      </div>
    ` : snapshots.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">📸</div>
        <h3>No snapshots yet</h3>
        <p>Take your first snapshot to start tracking your net worth history.</p>
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
          const dateStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

          return `
            <div class="card snapshot-card" data-id="${snap.id}">
              <span class="snapshot-date">${dateStr}</span>
              <span class="snapshot-nw">${formatCurrency(snap.netWorth, snap.baseCurrency)}</span>
              ${changeHTML}
              <div class="snapshot-actions">
                <button class="btn-icon view-snapshot" data-id="${snap.id}" aria-label="View details">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="btn-icon delete-snapshot" data-id="${snap.id}" aria-label="Delete">
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
      showToast('Snapshot saved');
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
  const date = new Date(snap.date + 'T00:00:00');
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const assets = snap.accounts.filter(a => a.type === 'asset');
  const liabilities = snap.accounts.filter(a => a.type === 'liability');

  const body = `
    <div class="snapshot-detail-summary" style="text-align:center; margin-bottom: var(--space-lg);">
      <div class="net-worth-label">Net Worth</div>
      <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);">
        ${formatCurrency(snap.netWorth, snap.baseCurrency)}
      </div>
      <div style="display:flex; justify-content:center; gap:var(--space-xl); margin-top:var(--space-md); font-size:var(--font-size-sm);">
        <span class="text-green">Assets: ${formatCurrency(snap.totalAssets, snap.baseCurrency)}</span>
        <span class="text-red">Liabilities: ${formatCurrency(snap.totalLiabilities, snap.baseCurrency)}</span>
      </div>
    </div>
    ${assets.length > 0 ? `
      <div class="section-label">Assets</div>
      ${assets.map(a => `
        <div class="snapshot-detail-item">
          <span class="snapshot-detail-name">${a.name}</span>
          <span>${formatCurrency(a.balance, a.currency)}</span>
        </div>
      `).join('')}
    ` : ''}
    ${liabilities.length > 0 ? `
      <div class="section-label" style="margin-top:var(--space-md);">Liabilities</div>
      ${liabilities.map(a => `
        <div class="snapshot-detail-item">
          <span class="snapshot-detail-name">${a.name}</span>
          <span class="text-red">${formatCurrency(a.balance, a.currency)}</span>
        </div>
      `).join('')}
    ` : ''}
  `;

  openModal({ title: `Snapshot — ${dateStr}`, body });
}

function confirmDeleteSnapshot(id) {
  const body = `
    <p>Delete this snapshot? This cannot be undone.</p>
    <div class="form-actions" style="margin-top: var(--space-lg);">
      <button class="btn btn-secondary" id="cancel-del-snap">Cancel</button>
      <button class="btn btn-danger" id="confirm-del-snap">Delete</button>
    </div>
  `;

  openModal({ title: 'Delete Snapshot', body });

  document.getElementById('cancel-del-snap').addEventListener('click', closeModal);
  document.getElementById('confirm-del-snap').addEventListener('click', () => {
    deleteSnapshot(id);
    showToast('Snapshot deleted');
    closeModal();
    window.__rerender();
  });
}
