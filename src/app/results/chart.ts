import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

/** Loosely typed chart.js configuration (several chart types share this component). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChartCfg = ChartConfiguration<any, any, any>;

/** True once chart.js controllers and the shared theme are set up. */
let ready = false;

/**
 * Registers chart.js once and applies the app theme (fonts and colors from CSS tokens).
 */
function setup(): void {
  if (ready) return;
  ready = true;
  Chart.register(...registerables);
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const d = Chart.defaults;
  d.font.family = v('--font-body', 'sans-serif');
  d.font.size = 12;
  d.color = v('--color-muted', '#8fa3bd');
  d.borderColor = v('--color-border', '#2b3a52');
  d.plugins.tooltip.backgroundColor = '#0b1120';
  d.plugins.tooltip.titleColor = v('--color-text-strong', '#f8fafc');
  d.plugins.tooltip.bodyColor = v('--color-text', '#e2e8f0');
  d.plugins.tooltip.borderColor = v('--color-border-strong', '#3d516f');
  d.plugins.tooltip.borderWidth = 1;
  d.plugins.tooltip.padding = 10;
  d.plugins.legend.labels.color = v('--color-text', '#e2e8f0');
}

/** Thin wrapper that owns one chart.js instance and keeps it in sync with `config`. */
@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block w-full min-w-0', '[style.height.px]': 'height()' },
  template: `<canvas #cv [attr.aria-label]="label()" role="img"></canvas>`,
})
export class AppChart {
  /** Chart configuration; changes are applied in place. */
  readonly config = input.required<ChartCfg>();
  /** Fixed height in px. */
  readonly height = input(300);
  /** Accessible label of the canvas. */
  readonly label = input('Graphique');

  /** Canvas element. */
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  /** Live chart instance (null before first render). */
  private chart: Chart | null = null;

  constructor() {
    afterNextRender(() => {
      setup();
      this.chart = new Chart(this.canvas().nativeElement, this.config());
    });
    inject(DestroyRef).onDestroy(() => {
      this.chart?.destroy();
      this.chart = null;
    });
    effect(() => {
      const cfg = this.config();
      const c = this.chart;
      if (!c) return;
      c.data = cfg.data;
      c.options = cfg.options ?? {};
      c.update();
    });
  }
}
