import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { repairProvision, formatEur, formatEur2 } from '../core/calc';
import { ComparisonStore } from '../core/comparison-store';
import { Car, RepairItem } from '../core/model';
import { COMMON_FIELDS, consumptionLabel, readNum } from './util';

/** Editable card for one car. */
@Component({
  selector: 'app-car-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '[style.--c]': 'car().color' },
  template: `
    <article class="card card-glass relative flex h-full min-w-0 flex-col border-t-[3px] border-t-[color:var(--c)] transition duration-200 [box-shadow:var(--shadow-card),0_-12px_30px_-18px_var(--c)] hover:-translate-y-0.5 motion-reduce:transform-none">
      <div class="mb-3 flex items-center gap-2">
        <input type="color" [value]="car().color" [attr.aria-label]="'Couleur de ' + car().name" (input)="patch({ color: $any($event.target).value })" />
        <input type="text" class="font-display text-[1.05rem] font-bold" [value]="car().name" [title]="car().name" aria-label="Nom de la voiture" (input)="patch({ name: $any($event.target).value })" />
      </div>
      <div class="mb-3 flex flex-wrap justify-end gap-0.5" role="group" aria-label="Actions sur la voiture">
        <button type="button" class="btn btn-ghost btn-sm" (click)="store.moveCar(car().id, -1)" [disabled]="first()" aria-label="Déplacer à gauche">←</button>
        <button type="button" class="btn btn-ghost btn-sm" (click)="store.moveCar(car().id, 1)" [disabled]="last()" aria-label="Déplacer à droite">→</button>
        <button type="button" class="btn btn-ghost btn-sm" (click)="store.duplicateCar(car().id)">Dupliquer</button>
        <button type="button" class="btn btn-danger btn-sm" (click)="remove()">Supprimer</button>
      </div>

      <div class="field">
        <label [for]="id('energy')">Énergie</label>
        <select [id]="id('energy')" [value]="car().energy" (change)="patch({ energy: $any($event.target).value })">
          <option value="electric">Électrique</option>
          <option value="diesel">Diesel</option>
        </select>
      </div>
      <label class="mb-2 flex cursor-pointer items-center gap-2 text-[0.86rem] text-muted"><input type="checkbox" [checked]="car().owned" (change)="patch({ owned: $any($event.target).checked })" /> Déjà possédée</label>

      @if (car().owned) {
        <div class="field">
          <label [for]="id('currentValue')">Valeur actuelle, €</label>
          <input type="number" min="0" step="500" [id]="id('currentValue')" [value]="car().currentValue" (input)="setNum('currentValue', $event)" />
        </div>
        <label class="mb-2 flex cursor-pointer items-center gap-2 text-[0.86rem] text-muted"><input type="checkbox" [checked]="car().includeDepreciation" (change)="patch({ includeDepreciation: $any($event.target).checked })" /> Inclure la décote (coût d'opportunité)</label>
      } @else {
        <div class="field">
          <label [for]="id('price')">Prix d'achat, €</label>
          <input type="number" min="0" step="500" [id]="id('price')" [value]="car().price" (input)="setNum('price', $event)" />
        </div>
      }

      <div class="field">
        <label [for]="id('consumption')">{{ consLabel() }}</label>
        <input type="number" min="0" step="0.1" [id]="id('consumption')" [value]="car().consumption" (input)="setNum('consumption', $event)" />
      </div>
      @for (f of fields; track f.key) {
        <div class="field">
          <label [for]="id(f.key)">{{ f.label }}</label>
          <input type="number" min="0" [attr.max]="f.max ?? null" [step]="f.step" [id]="id(f.key)" [value]="car()[f.key]" (input)="setNum(f.key, $event, f.max)" />
        </div>
      }

      <details class="my-3 rounded-sm border border-border px-3 py-2" [open]="car().repairItems.length > 0">
        <summary class="flex cursor-pointer justify-between gap-2 text-[0.9rem] font-semibold"><span>Réparations estimées</span><span class="num">Provision : {{ fmt(provision()) }}/an</span></summary>
        @if (car().repairItems.length === 0) {
          <div class="field mt-2">
            <label [for]="id('repairs')">Forfait réparations, €/an</label>
            <input type="number" min="0" step="100" [id]="id('repairs')" [value]="car().repairs" (input)="setNum('repairs', $event)" />
          </div>
          <p class="mt-2 text-[0.78rem] text-muted">Ajouter une ligne bascule en mode détaillé (probabilité / an x coût).</p>
        } @else {
          <div class="mt-2 grid grid-cols-[minmax(0,1fr)_64px_76px_32px] gap-2 text-[0.7rem] leading-tight text-muted min-[481px]:grid-cols-[minmax(0,1fr)_72px_84px_32px]" aria-hidden="true">
            <span>Libellé</span><span>Probabilité / an, %</span><span>Coût, €</span>
          </div>
        }
        @for (r of car().repairItems; track $index; let i = $index) {
          <div class="mt-2 grid grid-cols-[minmax(0,1fr)_64px_76px_32px] items-center gap-2 min-[481px]:grid-cols-[minmax(0,1fr)_72px_84px_32px]">
            <input type="text" [value]="r.label" [attr.aria-label]="'Libellé de la réparation ' + (i + 1)" placeholder="Libellé" (input)="setRepair(i, { label: $any($event.target).value })" />
            <input type="number" min="0" max="100" [value]="r.probabilityPct" [attr.aria-label]="'Probabilité par an, en %, de la réparation ' + (i + 1)" (input)="setRepairNum(i, 'probabilityPct', $event, 100)" />
            <input type="number" min="0" step="50" [value]="r.cost" [attr.aria-label]="'Coût en euros de la réparation ' + (i + 1)" (input)="setRepairNum(i, 'cost', $event)" />
            <button type="button" class="btn btn-ghost btn-sm px-0" [attr.aria-label]="'Supprimer la réparation ' + (i + 1)" (click)="removeRepair(i)">×</button>
            <span class="num col-span-3 -mt-1 text-right text-[0.78rem] text-muted">Espéré : {{ fmt((r.probabilityPct / 100) * r.cost) }}/an</span>
          </div>
        }
        <button type="button" class="btn btn-sm mt-3" (click)="addRepair()">+ Ligne</button>
        @if (car().repairItems.length > 0) {
          <p class="mt-2 text-[0.78rem] text-muted">Provision : <strong class="num">{{ fmt(provision()) }}/an</strong></p>
        }
      </details>

      @if (result(); as r) {
        <div class="mt-auto flex flex-wrap items-baseline justify-between gap-2 border-t border-dashed border-border-strong pt-3">
          <span class="num overflow-hidden text-[1.2rem] font-bold text-ellipsis text-text-strong">{{ fmt(r.total) }}</span>
          <span class="num text-muted">{{ fmt2(r.perKm) }} / km</span>
          @if (isBest()) { <span class="chip chip-good">Moins chère</span> }
        </div>
      }
    </article>
`,
})
export class CarCard {
  /** Shared comparison store. */
  protected readonly store = inject(ComparisonStore);
  /** The car to edit. */
  readonly car = input.required<Car>();
  /** True when the card is the first one. */
  readonly first = input(false);
  /** True when the card is the last one. */
  readonly last = input(false);

  /** Shared numeric fields. */
  protected readonly fields = COMMON_FIELDS;
  /** Consumption label by energy. */
  protected readonly consLabel = computed(() => consumptionLabel(this.car()));
  /** Repair provision. */
  protected readonly provision = computed(() => repairProvision(this.car()));
  /** Computed result for this car. */
  protected readonly result = computed(() => this.store.results().find((r) => r.car.id === this.car().id));
  /** True when this is the cheapest car. */
  protected readonly isBest = computed(() => this.store.best()?.car.id === this.car().id);

  /**
   * Unique DOM id for a field of this card.
   * @param key Field key.
   */
  protected id(key: string): string {
    return `c-${this.car().id}-${key}`;
  }

  /**
   * Euro format.
   * @param n Amount.
   */
  protected fmt(n: number): string {
    return formatEur(n);
  }

  /**
   * Euro format with cents.
   * @param n Amount.
   */
  protected fmt2(n: number): string {
    return formatEur2(n);
  }

  /**
   * Patches this car in the store.
   * @param p Fields to change.
   */
  protected patch(p: Partial<Car>): void {
    this.store.updateCar(this.car().id, p);
  }

  /**
   * Applies a numeric input to a car field.
   * @param key Car key.
   * @param e Input event.
   * @param max Upper bound.
   */
  protected setNum(key: keyof Car, e: Event, max?: number): void {
    const v = readNum(e, 0, max);
    if (v !== null) this.patch({ [key]: v });
  }

  /** Asks confirmation, then removes the car. */
  protected remove(): void {
    if (confirm(`Supprimer « ${this.car().name} » ?`)) this.store.removeCar(this.car().id);
  }

  /** Appends an empty repair line. */
  protected addRepair(): void {
    this.patch({ repairItems: [...this.car().repairItems, { label: '', probabilityPct: 50, cost: 0 }] });
  }

  /**
   * Removes a repair line.
   * @param i Row index.
   */
  protected removeRepair(i: number): void {
    this.patch({ repairItems: this.car().repairItems.filter((_, j) => j !== i) });
  }

  /**
   * Patches a repair line.
   * @param i Row index.
   * @param p Fields to change.
   */
  protected setRepair(i: number, p: Partial<RepairItem>): void {
    this.patch({ repairItems: this.car().repairItems.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  }

  /**
   * Applies a numeric input to a repair line.
   * @param i Row index.
   * @param key Repair key.
   * @param e Input event.
   * @param max Upper bound.
   */
  protected setRepairNum(i: number, key: 'probabilityPct' | 'cost', e: Event, max?: number): void {
    const v = readNum(e, 0, max);
    if (v !== null) this.setRepair(i, { [key]: v });
  }
}
