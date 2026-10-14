import { getAccounts, getSnapshots, calculateNetWorth, getSettings, convertToBase } from '../store.js';
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES, getCategoryInfo } from '../models.js';
import { formatCurrency, getCurrencySymbol } from '../components/currency.js';
import { ICONS } from '../components/icons.js';
import { t } from '../i18n.js';

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
    const changeStr = `${sign}${formatCurrency(change, settings.baseCurrency)} (${sign}${pct.toFixed(1)}%)`;
    changeHTML = `
      <div class="net-worth-change ${change >= 0 ? 'net-worth-change--up' : 'net-worth-change--down'}">
        ${change >= 0 ? '▲' : '▼'} ${t('dashboard.sinceLastSnapshotTemplate', changeStr)}
      </div>
    `;
  }

  const symbol = getCurrencySymbol(settings.baseCurrency);
  const amountStr = Math.abs(netWorth).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const grossTotal = totalAssets + totalLiabilities;
  const debtRatio = totalAssets > 0 ? `${((totalLiabilities / totalAssets) * 100).toFixed(0)}%` : '';

  // Category breakdown
  const categoryData = computeCategoryBreakdown(accounts, settings);

  return `
    <div class="view-header">
      <h1>${t('dashboard.title')}</h1>
    </div>

    <div class="net-worth-card card">
      <div class="net-worth-label">${t('dashboard.netWorth')}</div>
      <div class="net-worth-value ${netWorth < 0 ? 'net-worth-value--negative' : ''}">
        <span class="net-worth-symbol">${netWorth < 0 ? '-' : ''}${symbol}</span><span>${amountStr}</span>
      </div>
      ${changeHTML}
      ${renderSparkline(snapshots, netWorth)}
      <div class="net-worth-breakdown">
        <div class="net-worth-breakdown-item">
          <span class="breakdown-label"><i class="breakdown-dot breakdown-dot--asset"></i>${t('dashboard.totalAssets')}</span>
          <span class="breakdown-value">${formatCurrency(totalAssets, settings.baseCurrency)}</span>
        </div>
        <div class="net-worth-breakdown-item">
          <span class="breakdown-label"><i class="breakdown-dot breakdown-dot--liability"></i>${t('dashboard.totalLiabilities')}</span>
          <span class="breakdown-value">${formatCurrency(totalLiabilities, settings.baseCurrency)}</span>
        </div>
      </div>
      ${grossTotal > 0 ? `
        <div class="ratio-bar" aria-hidden="true">
          <div class="ratio-bar-asset" style="flex: ${totalAssets}"></div>
          <div class="ratio-bar-liability" style="flex: ${totalLiabilities}"></div>
        </div>
        ${totalAssets > 0 ? `<div class="breakdown-ratio">${t('dashboard.debtRatioTemplate', debtRatio)}</div>` : ''}
      ` : ''}
    </div>

    ${renderOnboarding(accounts.length, snapshots.length)}

    ${accounts.length === 0 ? '' : `
      <div class="dashboard-grid">
        <div class="card chart-card">
          <h3 class="card-title">${t('dashboard.assetAllocation')}</h3>
          <div class="chart-container">
            <canvas id="allocation-chart"></canvas>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">${t('dashboard.byCategory')}</h3>
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
          <h3 class="card-title">${t('dashboard.allAccounts')}</h3>
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

function renderSparkline(snapshots, currentNetWorth) {
  if (snapshots.length === 0) return '';
  // Oldest → newest (last 12 snapshots), ending with the live value
  const values = snapshots.slice(0, 12).reverse().map(s => s.netWorth).concat(currentNetWorth);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 300, h = 40, pad = 3;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `
    <svg class="net-worth-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${points}" fill="none" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
  `;
}

function renderOnboarding(accountCount, snapshotCount) {
  const steps = [
    { label: t('onboarding.step1'), done: accountCount > 0, href: '#/accounts' },
    { label: t('onboarding.step2'), done: snapshotCount > 0, href: '#/snapshots' },
    { label: t('onboarding.step3'), done: snapshotCount > 1, href: '#/snapshots' }
  ];
  const currentIdx = steps.findIndex(s => !s.done);
  if (currentIdx === -1) return '';

  return `
    <div class="card onboarding-card">
      <h3 class="onboarding-title">${t('onboarding.title')}</h3>
      <p class="onboarding-subtitle">${t('onboarding.subtitle')}</p>
      <ol class="onboarding-steps">
        ${steps.map((step, i) => {
          const state = step.done ? 'done' : i === currentIdx ? 'current' : 'todo';
          const marker = step.done ? ICONS.check : `<span class="onboarding-num">${i + 1}</span>`;
          const inner = `
            <span class="onboarding-marker">${marker}</span>
            <span class="onboarding-label">${step.label}</span>
            ${state === 'current' ? `<span class="onboarding-go">${t('onboarding.go')} →</span>` : ''}
          `;
          return state === 'current'
            ? `<li><a href="${step.href}" class="onboarding-step onboarding-step--current">${inner}</a></li>`
            : `<li><div class="onboarding-step onboarding-step--${state}">${inner}</div></li>`;
        }).join('')}
      </ol>
    </div>
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
    result.push({ ...cat, label: t('category.' + cat.key) || cat.label, total, type });
  }

  return result;
}

function renderAllocationChart(canvas) {
  const settings = getSettings();
  const accounts = getAccounts();
  const categoryData = computeCategoryBreakdown(accounts, settings).filter(c => c.type === 'asset');

  if (categoryData.length === 0) return;

  const colorMap = {
    cash: '#2f8f5b',
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
