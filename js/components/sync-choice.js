import { openModal, closeModal } from './modal.js';
import { t, getDateLocale } from '../i18n.js';

function formatStamp(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(getDateLocale(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderOption(key, summary) {
  return `
    <button type="button" class="sync-option" data-choice="${key}">
      <span class="sync-option-title">${t('sync.' + key)}</span>
      <span class="sync-option-meta">${t('sync.summaryTemplate', summary.accounts, summary.snapshots)}</span>
      <span class="sync-option-meta">${t('sync.latestSnapshot')} ${summary.latestSnapshot || '—'}</span>
      <span class="sync-option-meta">${t('sync.lastUpdated')} ${formatStamp(summary.lastUpdated)}</span>
    </button>
  `;
}

// Ask which copy to keep when local and Drive data differ. Resolves 'local', 'drive' or null.
export function chooseSyncVersion(localSummary, driveSummary) {
  return new Promise(resolve => {
    let settled = false;
    const settle = (choice) => {
      if (settled) return;
      settled = true;
      resolve(choice);
    };

    const body = document.createElement('div');
    body.innerHTML = `
      <p>${t('sync.conflictDesc')}</p>
      <div class="sync-options">
        ${renderOption('local', localSummary)}
        ${renderOption('drive', driveSummary)}
      </div>
      <p class="form-hint">${t('sync.backupNote')}</p>
    `;

    openModal({ title: t('sync.conflictTitle'), body, onClose: () => settle(null) });

    body.querySelectorAll('.sync-option').forEach(btn => {
      btn.addEventListener('click', () => {
        settle(btn.dataset.choice);
        closeModal();
      });
    });
  });
}
