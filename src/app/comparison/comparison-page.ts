import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { formatEur, formatEur2 } from '../core/calc';
import { ComparisonStore } from '../core/comparison-store';
import { InputsSection } from '../inputs/inputs-section';
import { ResultsSection } from '../results/results-section';
import { Toolbar } from './toolbar';

/** localStorage key remembering whether the inputs column is hidden. */
const HIDDEN_KEY = 'ccc.inputs.hidden';

/** Page shell: sticky toolbar, then inputs and results (two columns on wide screens). */
@Component({
  selector: 'app-comparison-page',
  imports: [Toolbar, InputsSection, ResultsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-toolbar />
    @if (hero(); as h) {
      <aside class="mt-4 flex animate-reveal items-center gap-3 rounded-card border border-l-4 border-border border-l-[color:var(--c)] bg-card-2 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--c)_16%,transparent),transparent_70%)] px-4 py-3 max-sm:p-3 max-sm:text-[0.9rem]"
        [style.--c]="h.color" aria-label="Voiture gagnante">
        <span class="grid size-[34px] flex-none place-items-center rounded-full bg-[color:var(--c)] text-base text-accent-ink" aria-hidden="true">&#9733;</span>
        <p class="m-0 min-w-0 break-words">
          <strong class="font-display text-text-strong" [title]="h.name">{{ h.name }}</strong> gagne :
          <span class="num font-bold text-[color:var(--c)]">{{ h.total }}</span> sur {{ h.years }} an{{ h.years > 1 ? 's' : '' }},
          <span class="num font-bold text-[color:var(--c)]">{{ h.gap }}</span> de moins que la suivante.
        </p>
      </aside>
    }
    <div class="mt-4 flex justify-end">
      <button type="button" class="btn btn-sm" aria-controls="inputs-col" [attr.aria-expanded]="!hidden()" (click)="toggle()">
        {{ hidden() ? 'Afficher les paramètres' : 'Masquer les paramètres' }}
      </button>
    </div>
    <div class="group mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-6 motion-reduce:transition-none xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:transition-[grid-template-columns,gap] xl:duration-500 xl:ease-snap xl:data-[collapsed=true]:grid-cols-[minmax(0,0fr)_minmax(0,12fr)] xl:data-[collapsed=true]:gap-0"
      [attr.data-collapsed]="hidden()">
      <div id="inputs-col" class="min-w-0 group-data-[collapsed=true]:hidden xl:transition-opacity xl:duration-300 xl:group-data-[collapsed=true]:pointer-events-none xl:group-data-[collapsed=true]:block xl:group-data-[collapsed=true]:overflow-hidden xl:group-data-[collapsed=true]:opacity-0"
        [attr.aria-hidden]="hidden()" [attr.inert]="hidden() ? '' : null">
        <app-inputs-section />
      </div>
      <div class="min-w-0 xl:sticky xl:top-[84px] xl:max-h-[calc(100dvh-100px)] xl:overflow-y-auto xl:[scrollbar-width:thin]">
        @if (hidden() && strip().length) {
          <section class="mb-4 animate-reveal cursor-pointer rounded-card border border-dashed border-border-strong bg-card-2 px-4 py-3" aria-label="Voitures comparées" (click)="show()">
            <h2 class="mb-2 text-[0.8rem] font-semibold tracking-[0.08em] text-muted uppercase">Voitures comparées</h2>
            <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
              @for (c of strip(); track c.id) {
                <li class="max-w-full min-w-0">
                  <button type="button" class="flex max-w-full cursor-pointer flex-wrap items-center gap-2 rounded-sm border border-l-4 border-[color:var(--c)] bg-card px-2.5 py-1.5 text-left transition hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--c)_14%,var(--color-card))] motion-reduce:transform-none"
                    [style.--c]="c.color" [title]="c.name + ' - afficher les paramètres'" (click)="show()">
                    <span class="dot" aria-hidden="true"></span>
                    <span class="max-w-[14ch] truncate font-display font-bold text-text-strong">{{ c.name }}</span>
                    <span class="text-[0.78rem] text-muted">{{ c.energy === 'electric' ? '⚡ Électrique' : '⛽ Diesel' }}</span>
                    @if (c.owned) { <span class="chip">possédée</span> }
                    <span class="num text-[0.86rem] font-bold text-text-strong">{{ c.total }} <span class="font-normal text-muted">- {{ c.perKm }} / km</span></span>
                  </button>
                </li>
              }
            </ul>
          </section>
        }
        <app-results-section />
      </div>
    </div>
`,
})
export class ComparisonPage {
  /** Shared comparison store. */
  private readonly store = inject(ComparisonStore);
  /** Winner summary, null when fewer than two cars. */
  protected readonly hero = computed(() => {
    const rs = this.store.results();
    const best = this.store.best();
    if (rs.length < 2 || !best) return null;
    const next = rs.filter((r) => r !== best).reduce((a, b) => (b.total < a.total ? b : a));
    return {
      name: best.car.name,
      color: best.car.color,
      total: formatEur(best.total),
      gap: formatEur(next.total - best.total),
      years: this.store.data().settings.years,
    };
  });
  /** True when the inputs column is hidden, restored from localStorage. */
  protected readonly hidden = signal(this.loadHidden());
  /** Compact per-car recap shown while the inputs are hidden. */
  protected readonly strip = computed(() =>
    this.store.results().map((r) => ({
      id: r.car.id,
      name: r.car.name,
      color: r.car.color,
      energy: r.car.energy,
      owned: r.car.owned,
      total: formatEur(r.total),
      perKm: formatEur2(r.perKm),
    })),
  );
  /** Route param :id (bound through withComponentInputBinding). */
  readonly id = input<string>();

  /** Loads the routed comparison, or resets to seed on the root route. */
  private readonly sync = effect(() => {
    const id = this.id();
    untracked(() => {
      if (id) {
        if (this.store.id() !== id) void this.store.load(id);
      } else if (this.store.id() !== null || !this.store.dirty()) {
        this.store.newFromSeed();
      }
    });
  });

  /** Flips the hidden state of the inputs column. */
  protected toggle(): void {
    this.setHidden(!this.hidden());
  }

  /** Re-opens the inputs column. */
  protected show(): void {
    this.setHidden(false);
  }

  /**
   * Sets and remembers the hidden state.
   * @param v True to hide the inputs.
   */
  private setHidden(v: boolean): void {
    this.hidden.set(v);
    try {
      localStorage.setItem(HIDDEN_KEY, v ? '1' : '0');
    } catch {
      /* storage unavailable: state stays in memory only */
    }
  }

  /** Reads the remembered hidden state, defaulting to visible. */
  private loadHidden(): boolean {
    try {
      return localStorage.getItem(HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  }
}
