import { getAccounts, getSnapshots, calculateNetWorth, getSettings, convertToBase } from '../store.js';
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES, getCategoryInfo } from '../models.js';
import { formatCurrency } from '../components/currency.js';

export function render() {
  const settings = getSettings();
  const accounts = getAccounts();
  const snapshots = getSnapshots();
  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth();

  // Change since last snapshot
  let changeHTML = '';
  if (snapshots.length > 0) {
    const lastSnap = snapshots[0];
    const change = netWorth - lastSnap.netWorth;
    const pct = lastSnap.netWorth !== 0 ? ((change / Math.abs(lastSnap.netWorth)) * 100) : 0;
    const sign = change >= 0 ? '+' : '';
    const colorClass = change >= 0 ? 'text-green' : 'text-red';
    changeHTML = `
      <div class="net-worth-change ${colorClass}">
        ${sign}${formatCurrency(change, settings.baseCurrency)} (${sign}${pct.toFixed(1)}%) since last snapshot
      </div>
    `;
  }

  // Category breakdown
  const categoryData = computeCategoryBreakdown(accounts, settings);

  return `
    <div class="view-header">
      <h1>Dashboard</h1>
    </div>

    <div class="net-worth-card card">
      <div class="net-worth-label">Net Worth</div>
      <div class="net-worth-value ${netWorth < 0 ? 'text-red' : ''}">${formatCurrency(netWorth, settings.baseCurrency)}</div>
      ${changeHTML}
      <div class="net-worth-breakdown">
        <div class="net-worth-breakdown-item">
          <span class="breakdown-label">Total Assets</span>
          <span class="breakdown-value text-green">${formatCurrency(totalAssets, settings.baseCurrency)}</span>
        </div>
        <div class="net-worth-breakdown-item">
          <span class="breakdown-label">Total Liabilities</span>
          <span class="breakdown-value text-red">${formatCurrency(totalLiabilities, settings.baseCurrency)}</span>
        </div>
      </div>
    </div>

    ${accounts.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">🏦</div>
        <h3>Get started</h3>
        <p>Add your accounts to see your net worth.</p>
        <a href="#/accounts" class="btn btn-primary">+ Add Account</a>
      </div>
    ` : `
      <div class="dashboard-grid">
        <div class="card chart-card">
          <h3 class="card-title">Asset Allocation</h3>
          <div class="chart-container">
            <canvas id="allocation-chart"></canvas>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">By Category</h3>
          <div class="category-breakdown">
            ${categoryData.map(cat => `
              <div class="category-row">
                <span class="category-icon">${cat.icon}</span>
                <span class="category-name">${cat.label}</span>
                <span class="category-amount ${cat.type === 'liability' ? 'text-red' : ''}">${cat.type === 'liability' ? '-' : ''}${formatCurrency(cat.total, settings.baseCurrency)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">All Accounts</h3>
          <div class="account-summary-list">
            ${accounts.map(acc => `
              <div class="account-summary-item">
                <span class="account-summary-icon">${getCategoryInfo(acc.category).icon}</span>
                <span class="account-summary-name">${acc.name}</span>
                <span class="account-summary-amount ${acc.type === 'liability' ? 'text-red' : ''}">${acc.type === 'liability' ? '-' : ''}${formatCurrency(acc.balance, acc.currency)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `}
  `;
}

export function mount() {
  // Render chart if Chart.js is available and there are accounts
  const canvas = document.getElementById('allocation-chart');
  if (canvas && typeof Chart !== 'undefined') {
    renderAllocationChart(canvas);
  }
}

function computeCategoryBreakdown(accounts, settings) {
  const allCats = [...ASSET_CATEGORIES, ...LIABILITY_CATEGORIES];
  const result = [];

  for (const cat of allCats) {
    const catAccounts = accounts.filter(a => a.category === cat.key);
    if (catAccounts.length === 0) continue;

    const total = catAccounts.reduce((sum, acc) => {
      return sum + convertToBase(acc.balance, acc.currency, settings);
    }, 0);

    const type = ASSET_CATEGORIES.some(c => c.key === cat.key) ? 'asset' : 'liability';
    result.push({ ...cat, total, type });
  }

  return result;
}

function renderAllocationChart(canvas) {
  const settings = getSettings();
  const accounts = getAccounts();
  const categoryData = computeCategoryBreakdown(accounts, settings).filter(c => c.type === 'asset');

  if (categoryData.length === 0) return;

  const colorMap = {
    cash: '#34c759',
    investments: '#0071e3',
    fixed_assets: '#af52de',
    receivables: '#ff9500',
    other_assets: '#5ac8fa'
  };

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: categoryData.map(c => c.label),
      datasets: [{
        data: categoryData.map(c => c.total),
        backgroundColor: categoryData.map(c => colorMap[c.key] || '#999'),
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 8,
            color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim()
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = formatCurrency(ctx.parsed, settings.baseCurrency);
              const pct = ((ctx.parsed / categoryData.reduce((s, c) => s + c.total, 0)) * 100).toFixed(1);
              return ` ${ctx.label}: ${val} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}
