import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { formatEur, formatEur2, repairProvision } from '../core/calc';
import { ComparisonStore } from '../core/comparison-store';
import { Car } from '../core/model';
import { COMMON_FIELDS, consumptionLabel, readNum } from './util';

/** Spreadsheet-like editor: one column per car, one row per field. */
@Component({
  selector: 'app-cars-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="overflow-x-auto rounded-sm">
      <table class="tbl tbl-grid">
        <thead>
          <tr>
            <th class="sticky left-0 z-[2] border-t-[3px] border-t-transparent bg-card-2 align-bottom">Champ</th>
            @for (c of cars(); track c.id; let i = $index) {
              <th [style.--c]="c.color" scope="col" class="min-w-[150px] border-t-[3px] border-t-[color:var(--c)] bg-card-2 align-bottom">
                <div class="flex items-center gap-2">
                  <input type="color" class="h-[30px] w-[34px] flex-none" [value]="c.color" [attr.aria-label]="'Couleur de ' + c.name" (input)="patch(c, { color: $any($event.target).value })" />
                  <input type="text" class="min-w-[100px] font-bold" [value]="c.name" [attr.aria-label]="'Nom de la voiture ' + (i + 1)" (input)="patch(c, { name: $any($event.target).value })" />
                </div>
                <div class="mt-1 flex gap-0.5">
                  <button type="button" class="btn btn-ghost btn-sm" [disabled]="i === 0" aria-label="Déplacer à gauche" (click)="store.moveCar(c.id, -1)">←</button>
                  <button type="button" class="btn btn-ghost btn-sm" [disabled]="i === cars().length - 1" aria-label="Déplacer à droite" (click)="store.moveCar(c.id, 1)">→</button>
                  <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Dupliquer ' + c.name" (click)="store.duplicateCar(c.id)">⧉</button>
                  <button type="button" class="btn btn-danger btn-sm" [attr.aria-label]="'Supprimer ' + c.name" (click)="remove(c)">×</button>
                </div>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Énergie</th>
            @for (c of cars(); track c.id) {
              <td>
                <select [value]="c.energy" [attr.aria-label]="'Énergie de ' + c.name" (change)="patch(c, { energy: $any($event.target).value })">
                  <option value="electric">Électrique</option>
                  <option value="diesel">Diesel</option>
                </select>
              </td>
            }
          </tr>
          <tr>
            <th scope="row">Déjà possédée</th>
            @for (c of cars(); track c.id) {
              <td><input type="checkbox" [checked]="c.owned" [attr.aria-label]="c.name + ' déjà possédée'" (change)="patch(c, { owned: $any($event.target).checked })" /></td>
            }
          </tr>
          <tr>
            <th scope="row">Prix d'achat / valeur actuelle, €</th>
            @for (c of cars(); track c.id) {
              <td>
                <input type="number" min="0" step="500" [value]="c.owned ? c.currentValue : c.price" [attr.aria-label]="(c.owned ? 'Valeur actuelle de ' : 'Prix d\\'achat de ') + c.name" (input)="setNum(c, c.owned ? 'currentValue' : 'price', $event)" />
              </td>
            }
          </tr>
          <tr>
            <th scope="row">Inclure la décote (possédée)</th>
            @for (c of cars(); track c.id) {
              <td>
                @if (c.owned) {
                  <input type="checkbox" [checked]="c.includeDepreciation" [attr.aria-label]="'Inclure la décote de ' + c.name" (change)="patch(c, { includeDepreciation: $any($event.target).checked })" />
                } @else {
                  <span class="text-muted">-</span>
                }
              </td>
            }
          </tr>
          <tr>
            <th scope="row">Consommation (kWh ou L / 100 km)</th>
            @for (c of cars(); track c.id) {
              <td><input type="number" min="0" step="0.1" [value]="c.consumption" [attr.aria-label]="label(c) + ' - ' + c.name" (input)="setNum(c, 'consumption', $event)" /></td>
            }
          </tr>
          @for (f of fields; track f.key) {
            <tr>
              <th scope="row">{{ f.label }}</th>
              @for (c of cars(); track c.id) {
                <td><input type="number" min="0" [attr.max]="f.max ?? null" [step]="f.step" [value]="c[f.key]" [attr.aria-label]="f.label + ' - ' + c.name" (input)="setNum(c, f.key, $event, f.max)" /></td>
              }
            </tr>
          }
          <tr>
            <th scope="row">Réparations, €/an</th>
            @for (c of cars(); track c.id) {
              <td>
                @if (c.repairItems.length) {
                  <span class="num" title="Détail à éditer en mode Cartes">{{ fmt(provision(c)) }}</span>
                } @else {
                  <input type="number" min="0" step="100" [value]="c.repairs" [attr.aria-label]="'Forfait réparations - ' + c.name" (input)="setNum(c, 'repairs', $event)" />
                }
              </td>
            }
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            @for (c of cars(); track c.id) {
              <td class="num text-right font-bold data-[best=true]:text-good" [attr.data-best]="best() === c.id">{{ fmt(totals().get(c.id)?.total ?? 0) }}</td>
            }
          </tr>
          <tr>
            <th scope="row">Par km</th>
            @for (c of cars(); track c.id) {
              <td class="num text-right font-bold text-muted">{{ fmt2(totals().get(c.id)?.perKm ?? 0) }}</td>
            }
          </tr>
        </tfoot>
      </table>
    </div>
    <button type="button" class="btn mt-3" (click)="store.addCar()">+ Ajouter une voiture</button>
`,
})
export class CarsGrid {
  /** Shared comparison store. */
  protected readonly store = inject(ComparisonStore);
  /** Cars to show. */
  protected readonly cars = computed(() => this.store.data().cars);
  /** Shared numeric fields. */
  protected readonly fields = COMMON_FIELDS;
  /** Results indexed by car id. */
  protected readonly totals = computed(() => new Map(this.store.results().map((r) => [r.car.id, r])));
  /** Id of the cheapest car. */
  protected readonly best = computed(() => this.store.best()?.car.id);

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
   * Repair provision of a car.
   * @param c The car.
   */
  protected provision(c: Car): number {
    return repairProvision(c);
  }

  /**
   * Consumption label of a car.
   * @param c The car.
   */
  protected label(c: Car): string {
    return consumptionLabel(c);
  }

  /**
   * Patches a car in the store.
   * @param c The car.
   * @param p Fields to change.
   */
  protected patch(c: Car, p: Partial<Car>): void {
    this.store.updateCar(c.id, p);
  }

  /**
   * Applies a numeric input to a car field.
   * @param c The car.
   * @param key Car key.
   * @param e Input event.
   * @param max Upper bound.
   */
  protected setNum(c: Car, key: keyof Car, e: Event, max?: number): void {
    const v = readNum(e, 0, max);
    if (v !== null) this.patch(c, { [key]: v });
  }

  /**
   * Asks confirmation, then removes the car.
   * @param c The car.
   */
  protected remove(c: Car): void {
    if (confirm(`Supprimer « ${c.name} » ?`)) this.store.removeCar(c.id);
  }
}
