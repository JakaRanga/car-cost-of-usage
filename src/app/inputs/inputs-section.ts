import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ComparisonStore } from '../core/comparison-store';
import { CarCard } from './car-card';
import { CarsGrid } from './cars-grid';
import { SettingsPanel } from './settings-panel';

/** Display mode of the cars area. */
type Mode = 'cards' | 'grid';
/** localStorage key remembering the mode. */
const KEY = 'ccc.inputs.mode';

/** Inputs area: general settings, then the cars as cards or as a grid. */
@Component({
  selector: 'app-inputs-section',
  imports: [SettingsPanel, CarCard, CarsGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid grid-cols-[minmax(0,1fr)] gap-6' },
  template: `
    <app-settings-panel class="block animate-reveal" />
    <section class="min-w-0" aria-labelledby="cars-title">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="cars-title">Voitures ({{ store.data().cars.length }})</h2>
        <div class="inline-flex rounded-full border border-border-strong bg-bg-2 p-[3px]" role="group" aria-label="Mode d'affichage">
          <button type="button" class="cursor-pointer rounded-full px-4 py-[5px] text-[0.84rem] font-semibold text-muted transition aria-pressed:grad-accent aria-pressed:text-accent-ink" [attr.aria-pressed]="mode() === 'cards'" (click)="setMode('cards')">Cartes</button>
          <button type="button" class="cursor-pointer rounded-full px-4 py-[5px] text-[0.84rem] font-semibold text-muted transition aria-pressed:grad-accent aria-pressed:text-accent-ink" [attr.aria-pressed]="mode() === 'grid'" (click)="setMode('grid')">Tableau</button>
        </div>
      </div>
      @if (mode() === 'cards') {
        <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] items-stretch gap-4">
          @for (c of store.data().cars; track c.id; let i = $index; let l = $last) {
            <div class="block" animate.enter="animate-enter" animate.leave="animate-leave">
              <app-car-card [car]="c" [first]="i === 0" [last]="l" />
            </div>
          }
          <button type="button" class="grid min-h-[120px] cursor-pointer place-items-center rounded-card border-2 border-dashed border-border-strong text-base font-semibold text-muted transition hover:border-accent hover:bg-accent/5 hover:text-accent" (click)="store.addCar()">+ Ajouter une voiture</button>
        </div>
      } @else {
        <div class="card card-glass"><app-cars-grid /></div>
      }
    </section>
`,
})
export class InputsSection {
  /** Shared comparison store. */
  protected readonly store = inject(ComparisonStore);
  /** Current display mode, restored from localStorage. */
  protected readonly mode = signal<Mode>(this.load());

  /**
   * Changes and remembers the display mode.
   * @param m New mode.
   */
  protected setMode(m: Mode): void {
    this.mode.set(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* storage unavailable: mode stays in memory only */
    }
  }

  /** Reads the remembered mode, defaulting to cards. */
  private load(): Mode {
    try {
      return localStorage.getItem(KEY) === 'grid' ? 'grid' : 'cards';
    } catch {
      return 'cards';
    }
  }
}
