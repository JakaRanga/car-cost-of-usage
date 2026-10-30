import {
  breakEvenPrice, chargingHours, cumulativeByYear, defaultKmRange, formatEur, formatEur2, formatHours,
  referenceFor, sensitivity,
} from '../core/calc';
import { CarResult, Settings } from '../core/model';
import { ChartCfg } from './chart';

/** Categorical palette (dataviz dark steps) for the 7 cost categories. */
export const CATEGORY_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767'];
/** Sequential blue ramp (light to dark) for charging powers. */
const POWER_COLORS = ['#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#1c5cab', '#104281'];
/** Neutral color for reference series. */
const NEUTRAL = '#8fa3bd';
/** Surface color used as a 2px gap between fills. */
const SURFACE = '#1e293b';

/** Number formatter for kilometres. */
const nf = new Intl.NumberFormat('fr-FR');

/**
 * Shared chart options.
 * @param fmt Value formatter for axis and tooltip.
 * @param legend Show the legend.
 * @param stacked Stack bars.
 */
function opts(fmt: (n: number) => string, legend: boolean, stacked = false): NonNullable<ChartCfg['options']> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: legend, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14 } },
      tooltip: {
        callbacks: {
          label: (c: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${c.dataset.label ?? ''}: ${c.parsed.y == null ? 'n/a' : fmt(c.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { stacked, grid: { display: false } },
      y: { stacked, beginAtZero: true, ticks: { callback: (v: string | number) => fmt(+v) } },
    },
  };
}

/**
 * One bar per car, colored by car.
 * @param rs Results.
 * @param title Dataset label.
 * @param pick Value picker.
 * @param fmt Formatter.
 */
export function barPerCar(rs: CarResult[], title: string, pick: (r: CarResult) => number, fmt: (n: number) => string): ChartCfg {
  return {
    type: 'bar',
    data: {
      labels: rs.map((r) => r.car.name),
      datasets: [{ label: title, data: rs.map(pick), backgroundColor: rs.map((r) => r.car.color), borderRadius: 4, maxBarThickness: 64 }],
    },
    options: opts(fmt, false),
  };
}

/**
 * Stacked cost breakdown per car.
 * @param rs Results.
 */
export function breakdown(rs: CarResult[]): ChartCfg {
  const cats: [string, (r: CarResult) => number][] = [
    ['Énergie', (r) => r.energy], ['Pneus', (r) => r.tyres], ['Entretien', (r) => r.maintenance],
    ['Réparations', (r) => r.repairs], ['Assurance', (r) => r.insurance], ['Taxes et divers', (r) => r.misc],
    ['Décote nette', (r) => r.depreciation],
  ];
  return {
    type: 'bar',
    data: {
      labels: rs.map((r) => r.car.name),
      datasets: cats.map(([label, f], i) => ({
        label, data: rs.map(f), backgroundColor: CATEGORY_COLORS[i], borderColor: SURFACE, borderWidth: 2, maxBarThickness: 64,
      })),
    },
    options: opts(formatEur, true, true),
  };
}

/**
 * Cumulative cost by year, one line per car.
 * @param rs Results.
 * @param s Settings.
 */
export function cumulative(rs: CarResult[], s: Settings): ChartCfg {
  return {
    type: 'line',
    data: {
      labels: Array.from({ length: s.years + 1 }, (_, y) => `Année ${y}`),
      datasets: rs.map((r) => ({
        label: r.car.name, data: cumulativeByYear(r, s), borderColor: r.car.color, backgroundColor: r.car.color,
        borderWidth: 2, tension: 0, pointRadius: 4, pointHoverRadius: 6, pointBorderColor: SURFACE, pointBorderWidth: 2,
      })),
    },
    options: { ...opts(formatEur, true), scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v: string | number) => formatEur(+v) } } } },
  };
}

/**
 * Total cost against yearly distance, with the current distance marked.
 * @param rs Results.
 * @param s Settings.
 */
export function sensitivityChart(rs: CarResult[], s: Settings): ChartCfg {
  const kms = defaultKmRange();
  const series = rs.map((r) => sensitivity(r.car, s, kms));
  const all = series.flat();
  const lo = Math.min(...all, 0);
  const hi = Math.max(...all, 1);
  const lines = rs.map((r, i) => ({
    label: r.car.name, data: kms.map((k, j) => ({ x: k, y: series[i][j] })), borderColor: r.car.color, backgroundColor: r.car.color,
    borderWidth: 2, tension: 0, pointRadius: 3, pointHoverRadius: 6, pointBorderColor: SURFACE, pointBorderWidth: 2,
  }));
  const marker = {
    label: `Actuel : ${nf.format(s.kmPerYear)} km/an`, data: [{ x: s.kmPerYear, y: lo }, { x: s.kmPerYear, y: hi }],
    borderColor: NEUTRAL, borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0,
  };
  const o = opts(formatEur, true);
  return {
    type: 'line',
    data: { datasets: [...lines, marker] },
    options: {
      ...o,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        ...o.plugins,
        tooltip: {
          ...o.plugins?.tooltip,
          filter: (i: { datasetIndex: number }) => i.datasetIndex < rs.length,
          callbacks: {
            title: (i: { parsed: { x: number } }[]) => `${nf.format(i[0].parsed.x)} km/an`,
            label: (c: { dataset: { label?: string }; parsed: { y: number } }) => `${c.dataset.label}: ${formatEur(c.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { type: 'linear', min: kms[0], max: kms[kms.length - 1], grid: { display: false }, ticks: { stepSize: 5000, callback: (v: string | number) => `${+v / 1000} k` } },
        y: { min: Math.min(0, lo), ticks: { callback: (v: string | number) => formatEur(+v) } },
      },
    },
  };
}

/**
 * Break-even entries for non-owned cars.
 * @param rs Results.
 * @param s Settings.
 */
export function breakEvenRows(rs: CarResult[], s: Settings): { r: CarResult; ref: CarResult | undefined; price: number | null }[] {
  return rs
    .filter((r) => !r.car.owned)
    .map((r) => {
      const ref = referenceFor(r.car, rs);
      return { r, ref, price: ref ? breakEvenPrice(r, ref, s) : null };
    });
}

/**
 * Current price against break-even price.
 * @param rows Break-even rows.
 */
export function breakEvenChart(rows: ReturnType<typeof breakEvenRows>): ChartCfg {
  return {
    type: 'bar',
    data: {
      labels: rows.map((x) => (x.price == null ? `${x.r.car.name} (n/a)` : x.r.car.name)),
      datasets: [
        { label: "Prix d'achat actuel", data: rows.map((x) => x.r.car.price), backgroundColor: rows.map((x) => x.r.car.color), borderRadius: 4, maxBarThickness: 48 },
        { label: "Prix d'équilibre", data: rows.map((x) => x.price), backgroundColor: NEUTRAL, borderRadius: 4, maxBarThickness: 48 },
      ],
    },
    options: opts(formatEur, true),
  };
}

/**
 * Charging time for the trip, grouped by power.
 * @param evs Electric results.
 * @param s Settings.
 */
export function chargingChart(evs: CarResult[], s: Settings): ChartCfg {
  const o = opts(formatHours, true);
  return {
    type: 'bar',
    data: {
      labels: evs.map((r) => r.car.name),
      datasets: s.chargePowers.map((p, i) => ({
        label: `${p} kW`, data: evs.map((r) => chargingHours(r.car, s, p)),
        backgroundColor: POWER_COLORS[Math.min(i, POWER_COLORS.length - 1)], borderRadius: 4, maxBarThickness: 40,
      })),
    },
    options: { ...o, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (v: string | number) => formatHours(+v) } } } },
  };
}

export { formatEur, formatEur2 };
