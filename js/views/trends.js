import { getSnapshots, getSettings, getAccounts } from '../store.js';
import { formatCurrency } from '../components/currency.js';
import { t, getDateLocale } from '../i18n.js';
import { ICONS } from '../components/icons.js';
import { TIERS, getSnapshotTierTotals } from '../models.js';

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
        <button class="trend-btn trend-btn--active" data-mode="tiers">${t('trends.composition')}</button>
        <button class="trend-btn" data-mode="net">${t('trends.netWorth')}</button>
        <button class="trend-btn" data-mode="liquid">${t('trends.netVsLiquid')}</button>
      </div>
      <div class="chart-container" style="height: 320px;">
        <canvas id="trend-chart"></canvas>
      </div>
      <p class="chart-note" id="trend-estimate-note" hidden>${t('trends.estimatedNote')}</p>
    </div>

    <div class="card" style="margin-top: var(--space-md);">
      <h3 class="card-title">${t('trends.history')}</h3>
      <table class="history-table">
        <thead>
          <tr>
            <th>${t('trends.month')}</th>
            ${TIERS.map(tier => `<th class="num col-tier">${t('tier.' + tier.key)}</th>`).join('')}
            <th class="num">${t('trends.netWorth')}</th>
            <th class="num">${t('trends.change')}</th>
          </tr>
        </thead>
        <tbody>
          ${[...snapshots].reverse().map((snap, i, arr) => {
            const prev = arr[i + 1];
            const tiers = getSnapshotTierTotals(snap);
            const date = new Date(snap.date + 'T00:00:00');
            const dateStr = date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
            let changeStr = '—';
            let changeClass = '';
            if (prev) {
              const change = snap.netWorth - prev.netWorth;
              const sign = change >= 0 ? '+' : '';
              changeClass = change >= 0 ? 'text-green' : 'text-red';
              changeStr = `${sign}${formatCurrency(change, snap.baseCurrency)}`;
            }
            const tierValue = (key) => formatCurrency(tiers[key], snap.baseCurrency);
            return `
              <tr class="history-row">
                <td>${dateStr}</td>
                ${TIERS.map(tier => `<td class="num col-tier ${tier.key === 'liabilities' ? 'text-red' : ''}">${tierValue(tier.key)}</td>`).join('')}
                <td class="num history-net">${formatCurrency(snap.netWorth, snap.baseCurrency)}</td>
                <td class="num ${changeClass}">${changeStr}</td>
              </tr>
              <tr class="history-detail">
                <td colspan="${TIERS.length + 3}">
                  ${TIERS.map(tier => `
                    <div class="history-detail-item">
                      <span><i class="tier-dot" style="background:${tier.color}"></i>${t('tier.' + tier.key)}</span>
                      <span class="${tier.key === 'liabilities' ? 'text-red' : ''}">${tierValue(tier.key)}</span>
                    </div>
                  `).join('')}
                </td>
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

  renderTrendChart(canvas, 'tiers');

  // Mobile: tap a row to show its tier breakdown
  container.querySelectorAll('.history-row').forEach(row => {
    row.addEventListener('click', () => row.classList.toggle('history-row--expanded'));
  });

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
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit' });
  });

  const note = canvas.closest('.card').querySelector('#trend-estimate-note');
  note.hidden = true;

  if (mode === 'tiers') {
    renderTierChart(canvas, snapshots, labels, settings, textColor, borderColor);
    return;
  }

  const datasets = [{
    label: t('trends.netWorth'),
    data: snapshots.map(s => s.netWorth),
    borderColor: '#0071e3',
    backgroundColor: 'rgba(0, 113, 227, 0.1)',
    fill: true,
    tension: 0.3,
    pointRadius: 4,
    pointHoverRadius: 6
  }];

  let estimated = [];
  if (mode === 'liquid') {
    // Gap between the lines = personal-use assets + locked assets − long-term liabilities
    const liquid = snapshots.map(s => getSnapshotTierTotals(s, getAccounts()));
    estimated = liquid.map(l => l.estimated);
    const isEstimated = (i) => estimated[i];
    datasets[0].fill = false;
    datasets.push({
      label: t('dashboard.liquidNetWorth'),
      data: liquid.map(l => l.liquidNetWorth),
      borderColor: '#2f8f5b',
      backgroundColor: '#2f8f5b',
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: liquid.map((l, i) => isEstimated(i) ? 'transparent' : '#2f8f5b'),
      segment: {
        borderDash: (ctx) => (isEstimated(ctx.p0DataIndex) || isEstimated(ctx.p1DataIndex)) ? [5, 5] : undefined
      }
    });
    note.hidden = !estimated.some(Boolean);
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
          display: mode === 'liquid',
          labels: { color: textColor, usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const suffix = ctx.datasetIndex === 1 && estimated[ctx.dataIndex] ? ` (${t('trends.estimated')})` : '';
              return ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y, settings.baseCurrency)}${suffix}`;
            }
          }
        }
      }
    }
  });
}

// Stacked bars: asset tiers above zero, liabilities below, net worth line on top
function renderTierChart(canvas, snapshots, labels, settings, textColor, borderColor) {
  const tierTotals = snapshots.map(s => getSnapshotTierTotals(s));
  const datasets = [{
    type: 'line',
    label: t('trends.netWorth'),
    data: snapshots.map(s => s.netWorth),
    borderColor: textColor,
    backgroundColor: textColor,
    tension: 0.3,
    pointRadius: 3,
    order: 0
  }];
  for (const tier of TIERS) {
    const sign = tier.key === 'liabilities' ? -1 : 1;
    datasets.push({
      type: 'bar',
      label: t('tier.' + tier.key),
      data: tierTotals.map(totals => sign * totals[tier.key]),
      backgroundColor: tier.color,
      stack: 'tiers',
      maxBarThickness: 40,
      order: 1
    });
  }

  chartInstance = new Chart(canvas, {
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: textColor } },
        y: {
          stacked: true,
          grid: { color: borderColor },
          ticks: { color: textColor, callback: (val) => formatCurrency(val, settings.baseCurrency) }
        }
      },
      plugins: {
        legend: { labels: { color: textColor, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y, settings.baseCurrency)}`
          }
        }
      }
    }
  });
}
