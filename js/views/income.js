import { getTransactionsByMonth, upsertTransaction, deleteTransaction, calculateMonthlyPnl, getSettings, convertToBase } from '../store.js';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, getPnlCategoryInfo, createTransaction } from '../models.js';
import { formatCurrency } from '../components/currency.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

function formatMonthLabel(ym) {
  const [y, m] = ym.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

export function render() {
  const settings = getSettings();
  const txns = getTransactionsByMonth(currentMonth);
  const { totalIncome, totalExpenses, netSavings } = calculateMonthlyPnl(currentMonth);

  const incomeTxns = txns.filter(t => t.type === 'income').sort((a, b) => b.date.localeCompare(a.date));
  const expenseTxns = txns.filter(t => t.type === 'expense').sort((a, b) => b.date.localeCompare(a.date));

  // Category breakdowns
  const incomeByCategory = groupByCategory(incomeTxns, settings);
  const expenseByCategory = groupByCategory(expenseTxns, settings);

  return `
    <div class="view-header">
      <h1>Income & Expenses</h1>
      <button class="btn btn-primary" id="add-txn-btn">+ Add Entry</button>
    </div>

    <div class="month-nav card">
      <button class="btn btn-icon" id="prev-month" aria-label="Previous month">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="month-nav-label">${formatMonthLabel(currentMonth)}</span>
      <button class="btn btn-icon" id="next-month" aria-label="Next month">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <div class="pnl-summary card">
      <div class="pnl-summary-row">
        <div class="pnl-summary-item">
          <span class="pnl-summary-label">Income</span>
          <span class="pnl-summary-value text-green">${formatCurrency(totalIncome, settings.baseCurrency)}</span>
        </div>
        <div class="pnl-summary-item">
          <span class="pnl-summary-label">Expenses</span>
          <span class="pnl-summary-value text-red">${formatCurrency(totalExpenses, settings.baseCurrency)}</span>
        </div>
        <div class="pnl-summary-item">
          <span class="pnl-summary-label">Net Savings</span>
          <span class="pnl-summary-value ${netSavings >= 0 ? 'text-green' : 'text-red'}">${formatCurrency(netSavings, settings.baseCurrency)}</span>
        </div>
      </div>
      ${totalIncome > 0 || totalExpenses > 0 ? `
        <div class="pnl-bar">
          <div class="pnl-bar-income" style="width: ${totalIncome + totalExpenses > 0 ? (totalIncome / (totalIncome + totalExpenses) * 100) : 50}%"></div>
          <div class="pnl-bar-expense" style="width: ${totalIncome + totalExpenses > 0 ? (totalExpenses / (totalIncome + totalExpenses) * 100) : 50}%"></div>
        </div>
        ${totalIncome > 0 ? `<div class="pnl-savings-rate">Savings rate: ${((netSavings / totalIncome) * 100).toFixed(1)}%</div>` : ''}
      ` : ''}
    </div>

    ${txns.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">💸</div>
        <h3>No entries this month</h3>
        <p>Add income and expenses to track your cash flow.</p>
        <button class="btn btn-primary" id="add-txn-empty">+ Add Entry</button>
      </div>
    ` : `
      <div class="pnl-grid">
        <div class="card">
          <div class="pnl-section-header">
            <h3 class="card-title">Income</h3>
            <span class="text-green" style="font-weight:var(--font-weight-semibold);">${formatCurrency(totalIncome, settings.baseCurrency)}</span>
          </div>
          ${incomeByCategory.length > 0 ? `
            <div class="pnl-category-list">
              ${incomeByCategory.map(cat => `
                <div class="pnl-category-row">
                  <span class="category-icon">${cat.icon}</span>
                  <span class="category-name">${cat.label}</span>
                  <span class="category-amount text-green">${formatCurrency(cat.total, settings.baseCurrency)}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-secondary" style="font-size:var(--font-size-sm);">No income entries</p>'}
          <div class="pnl-txn-list">
            ${incomeTxns.map(t => renderTxnItem(t, settings)).join('')}
          </div>
        </div>

        <div class="card">
          <div class="pnl-section-header">
            <h3 class="card-title">Expenses</h3>
            <span class="text-red" style="font-weight:var(--font-weight-semibold);">${formatCurrency(totalExpenses, settings.baseCurrency)}</span>
          </div>
          ${expenseByCategory.length > 0 ? `
            <div class="pnl-category-list">
              ${expenseByCategory.map(cat => `
                <div class="pnl-category-row">
                  <span class="category-icon">${cat.icon}</span>
                  <span class="category-name">${cat.label}</span>
                  <span class="category-amount text-red">${formatCurrency(cat.total, settings.baseCurrency)}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-secondary" style="font-size:var(--font-size-sm);">No expense entries</p>'}
          <div class="pnl-txn-list">
            ${expenseTxns.map(t => renderTxnItem(t, settings)).join('')}
          </div>
        </div>
      </div>

      ${txns.length > 0 ? `
        <div class="card" style="margin-top:var(--space-lg);">
          <h3 class="card-title">Income vs Expenses</h3>
          <div class="chart-container">
            <canvas id="pnl-chart"></canvas>
          </div>
        </div>
      ` : ''}
    `}
  `;
}

function renderTxnItem(t, settings) {
  const cat = getPnlCategoryInfo(t.category);
  return `
    <div class="pnl-txn-item" data-id="${t.id}">
      <span class="pnl-txn-icon">${cat.icon}</span>
      <div class="pnl-txn-info">
        <span class="pnl-txn-desc">${t.description || cat.label}</span>
        <span class="pnl-txn-date">${t.date.slice(5)}</span>
      </div>
      <span class="pnl-txn-amount ${t.type === 'income' ? 'text-green' : 'text-red'}">
        ${t.type === 'expense' ? '-' : ''}${formatCurrency(t.amount, t.currency)}
      </span>
      <div class="pnl-txn-actions">
        <button class="btn-icon edit-txn" data-id="${t.id}" aria-label="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon delete-txn" data-id="${t.id}" aria-label="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `;
}

function groupByCategory(txns, settings) {
  const map = {};
  for (const t of txns) {
    const inBase = convertToBase(t.amount, t.currency, settings);
    if (!map[t.category]) {
      const info = getPnlCategoryInfo(t.category);
      map[t.category] = { ...info, total: 0 };
    }
    map[t.category].total += inBase;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
}

export function mount(container) {
  const settings = getSettings();

  // Month navigation
  container.querySelector('#prev-month')?.addEventListener('click', () => {
    currentMonth = shiftMonth(currentMonth, -1);
    window.__rerender();
  });

  container.querySelector('#next-month')?.addEventListener('click', () => {
    currentMonth = shiftMonth(currentMonth, 1);
    window.__rerender();
  });

  // Add transaction buttons
  const addBtn = container.querySelector('#add-txn-btn');
  const addEmptyBtn = container.querySelector('#add-txn-empty');
  if (addBtn) addBtn.addEventListener('click', () => openTxnModal(null, settings));
  if (addEmptyBtn) addEmptyBtn.addEventListener('click', () => openTxnModal(null, settings));

  // Edit & delete
  container.querySelectorAll('.edit-txn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const txns = getTransactionsByMonth(currentMonth);
      const txn = txns.find(t => t.id === id);
      if (txn) openTxnModal(txn, settings);
    });
  });

  container.querySelectorAll('.delete-txn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      openDeleteConfirm(id);
    });
  });

  // Render chart
  const canvas = container.querySelector('#pnl-chart');
  if (canvas && typeof Chart !== 'undefined') {
    renderPnlChart(canvas, settings);
  }
}

function openTxnModal(existing, settings) {
  const isEdit = !!existing;
  const defaultDate = existing ? existing.date : `${currentMonth}-${String(new Date().getDate()).padStart(2, '0')}`;

  const body = document.createElement('div');
  body.innerHTML = `
    <form class="form" id="txn-form">
      <div class="form-group">
        <label class="form-label">Type</label>
        <div class="pnl-type-toggle">
          <button type="button" class="pnl-type-btn ${!existing || existing.type === 'expense' ? 'pnl-type-btn--active' : ''}" data-type="expense">Expense</button>
          <button type="button" class="pnl-type-btn ${existing?.type === 'income' ? 'pnl-type-btn--active' : ''}" data-type="income">Income</button>
        </div>
        <input type="hidden" id="txn-type" value="${existing?.type || 'expense'}">
      </div>

      <div class="form-group">
        <label class="form-label" for="txn-category">Category</label>
        <select id="txn-category" required>
          <optgroup label="Expense" id="expense-opts">
            ${EXPENSE_CATEGORIES.map(c => `<option value="${c.key}" ${existing?.category === c.key ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
          </optgroup>
          <optgroup label="Income" id="income-opts">
            ${INCOME_CATEGORIES.map(c => `<option value="${c.key}" ${existing?.category === c.key ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
          </optgroup>
        </select>
      </div>

      <div class="form-row">
        <div class="form-group form-group--grow">
          <label class="form-label" for="txn-amount">Amount</label>
          <input type="number" id="txn-amount" step="0.01" min="0" value="${existing?.amount || ''}" placeholder="0" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="txn-currency">Currency</label>
          <select id="txn-currency" style="width:90px;">
            ${settings.currencies.map(c => `<option value="${c}" ${(existing?.currency || settings.baseCurrency) === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="txn-date">Date</label>
        <input type="date" id="txn-date" value="${defaultDate}" required>
      </div>

      <div class="form-group">
        <label class="form-label" for="txn-desc">Description (optional)</label>
        <input type="text" id="txn-desc" value="${existing?.description || ''}" placeholder="e.g. Monthly rent">
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="txn-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Add'}</button>
      </div>
    </form>
  `;

  openModal({ title: isEdit ? 'Edit Entry' : 'Add Entry', body });

  // Type toggle logic
  const typeInput = document.getElementById('txn-type');
  const categorySelect = document.getElementById('txn-category');
  const typeBtns = document.querySelectorAll('.pnl-type-btn');

  function setType(type) {
    typeInput.value = type;
    typeBtns.forEach(b => b.classList.toggle('pnl-type-btn--active', b.dataset.type === type));
    // Show relevant category group first
    const expenseOpts = document.getElementById('expense-opts');
    const incomeOpts = document.getElementById('income-opts');
    if (type === 'income') {
      categorySelect.insertBefore(incomeOpts, expenseOpts);
      if (!existing) categorySelect.value = INCOME_CATEGORIES[0].key;
    } else {
      categorySelect.insertBefore(expenseOpts, incomeOpts);
      if (!existing) categorySelect.value = EXPENSE_CATEGORIES[0].key;
    }
  }

  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => setType(btn.dataset.type));
  });

  // Set initial category ordering
  if (!existing) setType('expense');

  document.getElementById('txn-cancel').addEventListener('click', closeModal);

  document.getElementById('txn-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      type: typeInput.value,
      category: categorySelect.value,
      amount: parseFloat(document.getElementById('txn-amount').value),
      currency: document.getElementById('txn-currency').value,
      date: document.getElementById('txn-date').value,
      description: document.getElementById('txn-desc').value.trim()
    };

    if (isEdit) {
      upsertTransaction({ ...existing, ...data });
      showToast('Entry updated');
    } else {
      const txn = createTransaction(data);
      upsertTransaction(txn);
      showToast('Entry added');
    }

    // Update currentMonth to match the transaction date
    currentMonth = data.date.slice(0, 7);
    closeModal();
    window.__rerender();
  });
}

function openDeleteConfirm(id) {
  const body = `
    <p>Delete this entry? This cannot be undone.</p>
    <div class="form-actions" style="margin-top: var(--space-lg);">
      <button class="btn btn-secondary" id="cancel-del">Cancel</button>
      <button class="btn btn-danger" id="confirm-del">Delete</button>
    </div>
  `;
  openModal({ title: 'Delete Entry', body });

  document.getElementById('cancel-del').addEventListener('click', closeModal);
  document.getElementById('confirm-del').addEventListener('click', () => {
    deleteTransaction(id);
    showToast('Entry deleted');
    closeModal();
    window.__rerender();
  });
}

function renderPnlChart(canvas, settings) {
  // Show last 6 months of income vs expenses
  const months = [];
  for (let i = 5; i >= 0; i--) {
    months.push(shiftMonth(currentMonth, -i));
  }

  const incomeData = [];
  const expenseData = [];
  const labels = [];

  for (const m of months) {
    const { totalIncome, totalExpenses } = calculateMonthlyPnl(m);
    incomeData.push(totalIncome);
    expenseData.push(totalExpenses);
    labels.push(formatMonthLabel(m).replace(/\s\d{4}$/, m === months[0] || new Date(m + '-01').getMonth() === 0 ? ` '${m.slice(2, 4)}` : ''));
  }

  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim();
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim();

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: '#34c75980',
          borderColor: '#34c759',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: '#ff3b3080',
          borderColor: '#ff3b30',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, padding: 16, usePointStyle: true, pointStyleWidth: 8 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y, settings.baseCurrency)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor }
        },
        y: {
          beginAtZero: true,
          grid: { color: borderColor },
          ticks: {
            color: textColor,
            callback: (v) => {
              if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
              if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
              return v;
            }
          }
        }
      }
    }
  });
}
