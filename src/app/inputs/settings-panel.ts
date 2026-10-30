import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ComparisonStore } from '../core/comparison-store';
import { Settings } from '../core/model';
import { readNum } from './util';

/** A plain numeric setting. */
interface SettingField {
  /** Settings key. */
  key: keyof Settings & string;
  /** French label. */
  label: string;
  /** Input step. */
  step: number;
  /** Lower bound. */
  min: number;
}

/** "Paramètres généraux" panel. */
@Component({
  selector: 'app-settings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="card card-glass" aria-labelledby="settings-title">
      <h2 class="card-title" id="settings-title">Paramètres généraux</h2>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-x-6">
        @for (f of fields; track f.key) {
          <div class="field">
            <label [for]="'s-' + f.key">{{ f.label }}</label>
            <input type="number" [id]="'s-' + f.key" [min]="f.min" [step]="f.step" [value]="s()[f.key]" (input)="setNum(f, $event)" />
          </div>
        }
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-x-6">
        <div class="field field-stack">
          <label for="s-home">Part de recharge à domicile, %</label>
          <div class="grid grid-cols-[1fr_70px] items-center gap-2">
            <input type="range" min="0" max="100" step="1" aria-label="Part de recharge à domicile (curseur)" [value]="s().homeSharePct" (input)="setPct('homeSharePct', $event)" />
            <input type="number" id="s-home" min="0" max="100" [value]="s().homeSharePct" (input)="setPct('homeSharePct', $event)" />
          </div>
        </div>
        <div class="field field-stack">
          <label for="s-loss">Pertes de charge, %</label>
          <div class="grid grid-cols-[1fr_70px] items-center gap-2">
            <input type="range" min="0" max="100" step="1" aria-label="Pertes de charge (curseur)" [value]="s().chargingLossPct" (input)="setPct('chargingLossPct', $event)" />
            <input type="number" id="s-loss" min="0" max="100" [value]="s().chargingLossPct" (input)="setPct('chargingLossPct', $event)" />
          </div>
        </div>
      </div>
      <div class="field field-stack">
        <span class="label">Puissances de charge, kW</span>
        <div class="flex flex-wrap items-center gap-2">
          @for (p of s().chargePowers; track p) {
            <span class="chip">{{ p }} kW <button type="button" class="cursor-pointer rounded-full px-0.5 font-bold hover:text-danger" [attr.aria-label]="'Retirer ' + p + ' kW'" (click)="removePower(p)">×</button></span>
          }
          <span class="flex gap-2">
            <input #np type="number" class="w-20" min="1" step="1" placeholder="kW" aria-label="Ajouter une puissance en kW" (keydown.enter)="addPower(np)" />
            <button type="button" class="btn btn-sm" (click)="addPower(np)">Ajouter</button>
          </span>
        </div>
      </div>
    </section>
`,
})
export class SettingsPanel {
  /** Shared comparison store. */
  private readonly store = inject(ComparisonStore);
  /** Current settings. */
  protected readonly s = computed(() => this.store.data().settings);
  /** Plain numeric settings. */
  protected readonly fields: SettingField[] = [
    { key: 'kmPerYear', label: 'Kilométrage annuel, km', step: 1000, min: 0 },
    { key: 'years', label: 'Durée de détention, ans', step: 1, min: 1 },
    { key: 'dieselPrice', label: 'Prix du diesel, €/L', step: 0.01, min: 0 },
    { key: 'homeKwhPrice', label: 'kWh à domicile, €', step: 0.01, min: 0 },
    { key: 'fastKwhPrice', label: 'kWh borne rapide, €', step: 0.01, min: 0 },
    { key: 'tradeIn', label: 'Reprise du véhicule possédé, €', step: 500, min: 0 },
    { key: 'tripKm', label: 'Distance du trajet, km', step: 50, min: 1 },
  ];

  /**
   * Applies a plain numeric setting.
   * @param f Field definition.
   * @param e Input event.
   */
  protected setNum(f: SettingField, e: Event): void {
    const v = readNum(e, f.min, f.key === 'years' ? 15 : undefined);
    if (v !== null) this.store.updateSettings({ [f.key]: f.key === 'years' ? Math.round(v) : v });
  }

  /**
   * Applies a 0-100 percent setting.
   * @param key Setting key.
   * @param e Input event.
   */
  protected setPct(key: 'homeSharePct' | 'chargingLossPct', e: Event): void {
    const v = readNum(e, 0, 100);
    if (v !== null) this.store.updateSettings({ [key]: v });
  }

  /**
   * Adds a charging power from the input, then clears it.
   * @param el The number input.
   */
  protected addPower(el: HTMLInputElement): void {
    const v = el.valueAsNumber;
    if (Number.isNaN(v) || v <= 0) return;
    const list = this.s().chargePowers;
    if (!list.includes(v)) this.store.updateSettings({ chargePowers: [...list, v].sort((a, b) => a - b) });
    el.value = '';
  }

  /**
   * Removes a charging power.
   * @param p Power in kW.
   */
  protected removePower(p: number): void {
    this.store.updateSettings({ chargePowers: this.s().chargePowers.filter((x) => x !== p) });
  }
}
