import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { ComparisonStore } from '../core/comparison-store';
import {
  chargingHours, cumulativeByYear, formatEur, formatEur2, formatHours, yearlyCosts,
} from '../core/calc';
import { CarResult } from '../core/model';
import { AppChart } from './chart';
import {
  barPerCar, breakdown, breakEvenChart, breakEvenRows, chargingChart, cumulative, sensitivityChart,
} from './chart-configs';

/** Available tabs of the results column. */
type Tab = 'synthese' | 'graphiques' | 'tableaux';

/** One cell of a comparison table. */
interface Cell {
  /** Main text. */
  text: string;
  /** Muted second line. */
  sub?: string;
  /** Cheapest of its row. */
  best?: boolean;
}

/** One row of a comparison table. */
interface Row {
  /** Row header. */
  label: string;
  /** Row cells, one per car. */
  cells: Cell[];
  /** Bold total row. */
  strong?: boolean;
}

/** Number formatter for units and kilometres. */
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Results area: summary cards, recap tables and charts, reacting live to the store. */
@Component({
  selector: 'app-results-section',
  imports: [AppChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <section aria-label="Résultats">
      @if (!rs().length) {
        <div class="card border-dashed px-6 py-8 text-center"><h2>Résultats</h2><p class="text-muted">Ajoutez au moins une voiture pour voir la comparaison.</p></div>
      } @else {
        <div class="card-glass sticky top-0 z-[5] mb-4 flex gap-1 rounded-full border border-border p-1" role="tablist" aria-label="Sections des résultats" (keydown)="onTabKey($event)">
          @for (t of tabs; track t.id) {
            <button type="button" role="tab"
              class="flex-1 cursor-pointer rounded-full bg-transparent px-3 py-2 text-[0.88rem] font-semibold text-muted transition duration-150 not-aria-selected:hover:bg-slate-400/10 not-aria-selected:hover:text-text-strong focus-visible:outline-offset-[-2px] aria-selected:grad-accent aria-selected:text-accent-ink max-[480px]:px-1.5 max-[480px]:text-[0.82rem]"
              [id]="'tab-' + t.id" [attr.aria-selected]="tab() === t.id"
              [attr.aria-controls]="'panel-' + t.id" [attr.tabindex]="tab() === t.id ? 0 : -1" (click)="tab.set(t.id)">{{ t.label }}</button>
          }
        </div>

        <div role="tabpanel" [id]="'panel-' + tab()" [attr.aria-labelledby]="'tab-' + tab()" class="grid min-w-0 gap-4">
          @switch (tab()) {
            @case ('synthese') {
              <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-4">
                @for (r of rs(); track r.car.id; let i = $index) {
                  <article class="card card-glass group min-w-0 animate-reveal border-t-[3px] border-t-[color:var(--c)] p-4 transition duration-200 [animation-delay:calc(var(--i,0)*60ms)] hover:-translate-y-0.5 motion-reduce:transform-none data-[best=true]:shadow-[0_0_0_1px_var(--c),0_0_32px_-6px_var(--c),var(--shadow-card)] data-[best=true]:[background:linear-gradient(170deg,color-mix(in_srgb,var(--c)_14%,transparent),transparent_55%),linear-gradient(160deg,rgb(56_189_248/0.07),transparent_40%),var(--color-card)]"
                    [attr.data-best]="isBest(r)" [style.--c]="r.car.color" [style.--i]="i">
                    <header class="flex flex-wrap items-center gap-2">
                      <span class="dot"></span><h3 class="min-w-0 flex-1 truncate" [title]="r.car.name">{{ r.car.name }}</h3>
                      @if (isBest(r) && rs().length > 1) { <span class="chip chip-good">Moins chère</span> }
                    </header>
                    <p class="num mt-2 text-[2rem] leading-[1.1] font-bold tracking-[-0.02em] text-text-strong group-data-[best=true]:text-[color:var(--c)] max-[480px]:text-[1.7rem]">{{ eur(r.total) }}</p>
                    <p class="m-0 text-[0.8rem] text-muted">sur {{ years() }} an{{ years() > 1 ? 's' : '' }} et {{ km(totalKm()) }} km</p>
                    @if (rs().length > 1 && !isBest(r)) { <p class="num mt-1 text-[0.85rem] text-warn">+{{ eur(r.total - bestTotal()) }} vs la moins chère</p> }
                    <dl class="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[0.85rem] [&>dt]:text-muted [&>dd]:m-0 [&>dd]:text-right">
                      <dt>Annuel</dt><dd class="num">{{ eur(r.annual) }}</dd>
                      <dt>Au km</dt><dd class="num">{{ eur2(r.perKm) }}</dd>
                      <dt>Énergie</dt><dd class="num">{{ eur(r.energy) }}</dd>
                      <dt>Décote nette</dt><dd class="num">{{ eur(r.depreciation) }}</dd>
                      <dt>Capital net immobilisé</dt><dd class="num">{{ eur(r.capital) }}</dd>
                    </dl>
                  </article>
                }
              </div>

              <div class="card">
                <h2 class="card-title">Tableau récapitulatif détaillé</h2>
                <div class="overflow-x-auto rounded-sm">
                  <table class="tbl">
                    <thead><tr><th scope="col">Poste</th>@for (r of rs(); track r.car.id) { <th scope="col" class="num"><span class="dot" [style.--c]="r.car.color"></span> {{ r.car.name }}</th> }</tr></thead>
                    <tbody>
                      @for (row of rows(); track row.label) {
                        <tr class="data-[strong=true]:*:border-t data-[strong=true]:*:border-t-border-strong data-[strong=true]:*:font-bold" [attr.data-strong]="row.strong">
                          <th scope="row">{{ row.label }}</th>
                          @for (c of row.cells; track $index) {
                            <td class="num data-[low=true]:bg-good/[0.07] data-[low=true]:text-good" [attr.data-low]="c.best">{{ c.text }}@if (c.sub) { <small class="block text-[0.74rem] text-muted">{{ c.sub }}</small> }</td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <p class="m-0 text-[0.82rem] text-muted">
                Note : la décote est calculée après reprise du véhicule actuel (valeur de reprise déduite du capital immobilisé).
                Un véhicule déjà possédé n'a pas de prix d'achat ; sa décote n'est comptée que si l'option est activée.
                Les coûts récurrents (pneus, entretien, réparations, assurance, taxes) sont saisis par an et multipliés par la durée de détention : le tableau les affiche en total sur la période. Les provisions de réparations représentent un coût espéré (probabilité par an x coût), pas une dépense certaine.
              </p>
            }

            @case ('graphiques') {
              <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4 max-[480px]:grid-cols-[minmax(0,1fr)]">
                <div class="card min-w-0 p-4"><h3 class="card-title mb-3">Coût total</h3><app-chart [config]="cTotal()" label="Coût total par voiture" /></div>
                <div class="card min-w-0 p-4"><h3 class="card-title mb-3">Décomposition des coûts</h3><app-chart [config]="cBreakdown()" label="Décomposition des coûts" /></div>
                <div class="card min-w-0 p-4"><h3 class="card-title mb-3">Coût annuel moyen</h3><app-chart [config]="cAnnual()" label="Coût annuel moyen" /></div>
                <div class="card min-w-0 p-4"><h3 class="card-title mb-3">Coût au kilomètre</h3><app-chart [config]="cPerKm()" label="Coût au kilomètre" /></div>
                <div class="card col-span-full min-w-0 p-4"><h3 class="card-title mb-3">Coût cumulé par année</h3><app-chart [config]="cCumul()" label="Coût cumulé par année" /></div>
                <div class="card col-span-full min-w-0 p-4"><h3 class="card-title mb-3">Sensibilité au kilométrage</h3><p class="-mt-2 mb-3 text-[0.8rem] text-muted">Coût total sur {{ years() }} an{{ years() > 1 ? 's' : '' }} selon le kilométrage annuel</p><app-chart [config]="cSens()" label="Sensibilité au kilométrage" /></div>
                <div class="card min-w-0 p-4">
                  <h3 class="card-title mb-3">Prix d'achat d'équilibre</h3>
                  @if (be().length) {
                    <p class="-mt-2 mb-3 text-[0.8rem] text-muted">Référence : {{ refNames() }}</p>
                    <app-chart [config]="cBreak()" label="Prix d'achat d'équilibre" />
                  } @else { <p class="text-muted">Aucune voiture à acheter à comparer.</p> }
                </div>
                <div class="card min-w-0 p-4">
                  <h3 class="card-title mb-3">Temps de recharge pour le trajet</h3>
                  @if (evs().length) {
                    <p class="-mt-2 mb-3 text-[0.8rem] text-muted">Trajet de {{ km(store.data().settings.tripKm) }} km, pertes incluses</p>
                    <app-chart [config]="cCharge()" label="Temps de recharge" />
                  } @else { <p class="text-muted">Aucune voiture électrique dans la comparaison.</p> }
                </div>
              </div>
            }

            @case ('tableaux') {
              <div class="card">
                <h2 class="card-title">Coût par année</h2>
                <div class="overflow-x-auto rounded-sm">
                  <table class="tbl">
                    <thead><tr><th scope="col">Année</th>@for (r of rs(); track r.car.id) { <th scope="col" class="num"><span class="dot" [style.--c]="r.car.color"></span> {{ r.car.name }}</th> }</tr></thead>
                    <tbody>
                      @for (row of yearRows(); track row.label) {
                        <tr><th scope="row">{{ row.label }}</th>
                          @for (c of row.cells; track $index) { <td class="num">{{ c.text }}@if (c.sub) { <small class="block text-[0.74rem] text-muted">{{ c.sub }}</small> }</td> }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="card">
                <h2 class="card-title">Prix d'équilibre</h2>
                @if (be().length) {
                  <div class="overflow-x-auto rounded-sm">
                    <table class="tbl">
                      <thead><tr><th scope="col">Voiture</th><th scope="col">Référence</th><th scope="col" class="num">Prix actuel</th><th scope="col" class="num">Prix d'équilibre</th><th scope="col" class="num">Marge</th></tr></thead>
                      <tbody>
                        @for (x of be(); track x.r.car.id) {
                          <tr>
                            <th scope="row"><span class="dot" [style.--c]="x.r.car.color"></span> {{ x.r.car.name }}</th>
                            <td class="text-muted">{{ x.ref?.car?.name ?? 'n/a' }}</td>
                            <td class="num">{{ eur(x.r.car.price) }}</td>
                            <td class="num">{{ x.price == null ? 'n/a' : eur(x.price) }}</td>
                            <td class="num" [class.text-good]="x.price != null && x.r.car.price < x.price" [class.text-danger]="x.price != null && x.r.car.price >= x.price">{{ x.price == null ? 'n/a' : signed(x.price - x.r.car.price) }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else { <p class="text-muted">Aucune voiture à acheter à comparer.</p> }
              </div>

              <div class="card">
                <h2 class="card-title">Temps de recharge</h2>
                @if (evs().length) {
                  <div class="overflow-x-auto rounded-sm">
                    <table class="tbl">
                      <thead><tr><th scope="col">Voiture</th><th scope="col" class="num">Énergie (kWh)</th>@for (p of store.data().settings.chargePowers; track $index) { <th scope="col" class="num">{{ p }} kW</th> }</tr></thead>
                      <tbody>
                        @for (c of charge(); track c.id) {
                          <tr>
                            <th scope="row"><span class="dot" [style.--c]="c.color"></span> {{ c.name }}</th>
                            <td class="num">{{ c.kwh }}</td>
                            @for (t of c.times; track $index) { <td class="num">{{ t }}</td> }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <p class="mt-3 text-[0.8rem] text-muted">Trajet de {{ km(store.data().settings.tripKm) }} km, pertes incluses.</p>
                } @else { <p class="text-muted">Aucune voiture électrique dans la comparaison.</p> }
              </div>
            }
          }
        </div>
      }
    </section>
`,
})
export class ResultsSection {
  /** Shared comparison store. */
  protected readonly store = inject(ComparisonStore);
  /** Host element, used to focus the newly selected tab. */
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Tab definitions. */
  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'synthese', label: 'Synthèse' }, { id: 'graphiques', label: 'Graphiques' }, { id: 'tableaux', label: 'Tableaux' },
  ];
  /** Active tab. */
  protected readonly tab = signal<Tab>('synthese');

  /** Results per car. */
  protected readonly rs = this.store.results;
  /** Settings shortcut. */
  private readonly s = computed(() => this.store.data().settings);
  /** Period in years. */
  protected readonly years = computed(() => this.s().years);
  /** Total km over the period. */
  protected readonly totalKm = computed(() => this.s().kmPerYear * this.s().years);
  /** Total of the cheapest car. */
  protected readonly bestTotal = computed(() => this.store.best()?.total ?? 0);
  /** Electric results. */
  protected readonly evs = computed(() => this.rs().filter((r) => r.car.energy === 'electric'));
  /** Break-even entries. */
  protected readonly be = computed(() => breakEvenRows(this.rs(), this.s()));
  /** Distinct reference car names, joined. */
  protected readonly refNames = computed(() => [...new Set(this.be().map((x) => x.ref?.car.name).filter(Boolean))].join(', '));

  /** Chart: total cost. */
  protected readonly cTotal = computed(() => barPerCar(this.rs(), 'Coût total', (r) => r.total, formatEur));
  /** Chart: breakdown. */
  protected readonly cBreakdown = computed(() => breakdown(this.rs()));
  /** Chart: annual cost. */
  protected readonly cAnnual = computed(() => barPerCar(this.rs(), 'Coût annuel moyen', (r) => r.annual, formatEur));
  /** Chart: cost per km. */
  protected readonly cPerKm = computed(() => barPerCar(this.rs(), 'Coût au km', (r) => r.perKm, formatEur2));
  /** Chart: cumulative. */
  protected readonly cCumul = computed(() => cumulative(this.rs(), this.s()));
  /** Chart: sensitivity. */
  protected readonly cSens = computed(() => sensitivityChart(this.rs(), this.s()));
  /** Chart: break-even. */
  protected readonly cBreak = computed(() => breakEvenChart(this.be()));
  /** Chart: charging time. */
  protected readonly cCharge = computed(() => chargingChart(this.evs(), this.s()));

  /** Rows of the detailed summary table. */
  protected readonly rows = computed<Row[]>(() => {
    const rs = this.rs();
    const mk = (label: string, pick: (r: CarResult) => number, fmt: (n: number) => string, sub?: (r: CarResult) => string, strong = false): Row => {
      const vals = rs.map(pick);
      const min = Math.min(...vals);
      return { label, strong, cells: rs.map((r, i) => ({ text: fmt(vals[i]), sub: sub?.(r), best: rs.length > 1 && vals[i] === min })) };
    };
    return [
      mk('Énergie / carburant', (r) => r.energy, formatEur, (r) => `${nf.format(r.energyUnits)} ${r.car.energy === 'electric' ? 'kWh' : 'L'}`),
      mk('Pneus été + hiver', (r) => r.tyres, formatEur),
      mk('Entretien programmé', (r) => r.maintenance, formatEur),
      mk('Provision réparations', (r) => r.repairs, formatEur),
      mk('Assurance', (r) => r.insurance, formatEur),
      mk('Taxes et divers', (r) => r.misc, formatEur),
      mk('Décote nette', (r) => r.depreciation, formatEur),
      mk('Total sur la période', (r) => r.total, formatEur, undefined, true),
      mk('Coût annuel moyen', (r) => r.annual, formatEur),
      mk('Coût au kilomètre', (r) => r.perKm, formatEur2),
    ];
  });

  /** Rows of the per-year table (year 0 = capital). */
  protected readonly yearRows = computed<Row[]>(() => {
    const rs = this.rs();
    const s = this.s();
    const cum = rs.map((r) => cumulativeByYear(r, s));
    const yc = rs.map((r) => yearlyCosts(r, s));
    const out: Row[] = [{ label: 'Année 0 (capital)', cells: rs.map((_, i) => ({ text: formatEur(cum[i][0]) })) }];
    for (let y = 1; y <= s.years; y++) {
      out.push({ label: `Année ${y}`, cells: rs.map((_, i) => ({ text: formatEur(yc[i][y - 1]), sub: `cumul ${formatEur(cum[i][y])}` })) });
    }
    return out;
  });

  /** Rows of the charging table. */
  protected readonly charge = computed(() => {
    const s = this.s();
    return this.evs().map((r) => ({
      id: r.car.id, name: r.car.name, color: r.car.color,
      kwh: nf.format(((s.tripKm * r.car.consumption) / 100) * (1 + s.chargingLossPct / 100)),
      times: s.chargePowers.map((p) => { const h = chargingHours(r.car, s, p); return h == null ? '-' : formatHours(h); }),
    }));
  });

  /**
   * Arrow/Home/End keyboard navigation between tabs; focuses the new tab.
   * @param e Keyboard event from the tablist.
   */
  protected onTabKey(e: KeyboardEvent): void {
    const i = this.tabs.findIndex((t) => t.id === this.tab());
    const n = this.tabs.length;
    const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = this.tabs[next].id;
    this.tab.set(id);
    this.host.nativeElement.querySelector<HTMLElement>('#tab-' + id)?.focus();
  }

  /**
   * True when the result is the cheapest.
   * @param r Result.
   */
  protected isBest(r: CarResult): boolean {
    return this.store.best() === r;
  }

  /**
   * Formats EUR, no decimals.
   * @param n Amount.
   */
  protected eur(n: number): string { return formatEur(n); }

  /**
   * Formats EUR, 2 decimals.
   * @param n Amount.
   */
  protected eur2(n: number): string { return formatEur2(n); }

  /**
   * Formats a distance or count.
   * @param n Number.
   */
  protected km(n: number): string { return nf.format(n); }

  /**
   * Formats EUR with an explicit sign.
   * @param n Amount.
   */
  protected signed(n: number): string { return `${n >= 0 ? '+' : ''}${formatEur(n)}`; }
}
