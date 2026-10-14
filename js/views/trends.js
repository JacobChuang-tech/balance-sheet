import { getSnapshots, getSettings } from '../store.js';
import { formatCurrency } from '../components/currency.js';
import { t, getDateLocale } from '../i18n.js';
import { ICONS } from '../components/icons.js';

let chartInstance = null;

export function render() {
  const snapshots = getSnapshots().reverse(); // oldest first for chart
  const settings = getSettings();
  const locale = getDateLocale();

  if (snapshots.length < 2) {
    return `
      <div class="view-header">
        <h1>${t('trends.title')}</h1>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon">${ICONS.trend}</div>
        <h3>${t('trends.notEnoughData')}</h3>
        <p>${t('trends.takeMoreSnapshots')}</p>
        <a href="#/snapshots" class="btn btn-primary">${t('trends.goToSnapshots')}</a>
      </div>
    `;
  }

  return `
    <div class="view-header">
      <h1>${t('trends.title')}</h1>
    </div>

    <div class="card chart-card">
      <h3 class="card-title">${t('trends.netWorthOverTime')}</h3>
      <div class="trend-controls">
        <button class="trend-btn trend-btn--active" data-mode="net">${t('trends.netWorth')}</button>
        <button class="trend-btn" data-mode="all">${t('trends.assetsAndLiabilities')}</button>
      </div>
      <div class="chart-container" style="height: 320px;">
        <canvas id="trend-chart"></canvas>
      </div>
    </div>

    <div class="card" style="margin-top: var(--space-md);">
      <h3 class="card-title">${t('trends.history')}</h3>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="font-size:var(--font-size-sm); color:var(--color-text-secondary);">
            <th style="text-align:left; padding:var(--space-sm) 0; border-bottom:1px solid var(--color-border);">${t('trends.month')}</th>
            <th style="text-align:right; padding:var(--space-sm) 0; border-bottom:1px solid var(--color-border);">${t('trends.assets')}</th>
            <th style="text-align:right; padding:var(--space-sm) 0; border-bottom:1px solid var(--color-border);">${t('trends.liabilities')}</th>
            <th style="text-align:right; padding:var(--space-sm) 0; border-bottom:1px solid var(--color-border);">${t('trends.netWorth')}</th>
            <th style="text-align:right; padding:var(--space-sm) 0; border-bottom:1px solid var(--color-border);">${t('trends.change')}</th>
          </tr>
        </thead>
        <tbody>
          ${[...snapshots].reverse().map((snap, i, arr) => {
            const prev = arr[i + 1];
            const date = new Date(snap.date + 'T00:00:00');
            const dateStr = date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
            let changeStr = '—';
            let changeClass = '';
            if (prev) {
              const change = snap.netWorth - prev.netWorth;
              const sign = change >= 0 ? '+' : '';
              changeClass = change >= 0 ? 'text-green' : 'text-red';
              changeStr = `${sign}${formatCurrency(change, snap.baseCurrency)}`;
            }
            return `
              <tr>
                <td style="padding:var(--space-sm) 0; border-bottom:1px solid var(--color-border);">${dateStr}</td>
                <td style="text-align:right; padding:var(--space-sm) 0; border-bottom:1px solid var(--color-border);">${formatCurrency(snap.totalAssets, snap.baseCurrency)}</td>
                <td style="text-align:right; padding:var(--space-sm) 0; border-bottom:1px solid var(--color-border); color:var(--color-red);">${formatCurrency(snap.totalLiabilities, snap.baseCurrency)}</td>
                <td style="text-align:right; padding:var(--space-sm) 0; border-bottom:1px solid var(--color-border); font-weight:var(--font-weight-semibold);">${formatCurrency(snap.netWorth, snap.baseCurrency)}</td>
                <td style="text-align:right; padding:var(--space-sm) 0; border-bottom:1px solid var(--color-border);" class="${changeClass}">${changeStr}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function mount(container) {
  const canvas = container.querySelector('#trend-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  renderTrendChart(canvas, 'net');

  container.querySelectorAll('.trend-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      container.querySelectorAll('.trend-btn').forEach(b => b.classList.remove('trend-btn--active'));
      e.currentTarget.classList.add('trend-btn--active');
      renderTrendChart(canvas, e.currentTarget.dataset.mode);
    });
  });
}

function renderTrendChart(canvas, mode) {
  if (chartInstance) chartInstance.destroy();

  const snapshots = getSnapshots().reverse();
  const settings = getSettings();
  const locale = getDateLocale();
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim();
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim();

  const labels = snapshots.map(s => {
    const d = new Date(s.date + 'T00:00:00');
    return d.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  });

  const datasets = [];

  if (mode === 'net' || mode === 'all') {
    datasets.push({
      label: t('trends.netWorth'),
      data: snapshots.map(s => s.netWorth),
      borderColor: '#0071e3',
      backgroundColor: 'rgba(0, 113, 227, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6
    });
  }

  if (mode === 'all') {
    datasets.push({
      label: t('trends.assets'),
      data: snapshots.map(s => s.totalAssets),
      borderColor: '#34c759',
      backgroundColor: 'transparent',
      borderDash: [5, 5],
      tension: 0.3,
      pointRadius: 3
    });
    datasets.push({
      label: t('trends.liabilities'),
      data: snapshots.map(s => s.totalLiabilities),
      borderColor: '#ff3b30',
      backgroundColor: 'transparent',
      borderDash: [5, 5],
      tension: 0.3,
      pointRadius: 3
    });
  }

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      scales: {
        x: {
          grid: { color: borderColor },
          ticks: { color: textColor }
        },
        y: {
          grid: { color: borderColor },
          ticks: {
            color: textColor,
            callback: (val) => formatCurrency(val, settings.baseCurrency)
          }
        }
      },
      plugins: {
        legend: {
          display: mode === 'all',
          labels: { color: textColor, usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y, settings.baseCurrency)}`
          }
        }
      }
    }
  });
}
