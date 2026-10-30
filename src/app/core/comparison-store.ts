import { computed, Injectable, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { cheapest, computeAll } from './calc';
import { ComparisonApi } from './comparison-api';
import { Car, ComparisonData, ComparisonSummary, Settings } from './model';
import { newCar, seedComparison } from './seed';

/** Single source of truth for the comparison being edited. */
@Injectable({ providedIn: 'root' })
export class ComparisonStore {
  /** API client. */
  private readonly api = inject(ComparisonApi);

  /** Backing field of the saved id. */
  private readonly _id = signal<string | null>(null);
  /** Backing field of the data. */
  private readonly _data = signal<ComparisonData>(seedComparison());
  /** True when data was edited since the last load/save/new. */
  private readonly dataDirty = signal(false);
  /** Name as of the last load/save/new, to detect name edits. */
  private readonly baseName = signal('Ma comparaison');
  /** Backing field of the saving flag. */
  private readonly _saving = signal(false);
  /** Backing field of the error message. */
  private readonly _error = signal<string | null>(null);
  /** Backing httpResource of the saved list. */
  private readonly savedRes = httpResource<ComparisonSummary[]>(() => '/api/comparisons');

  /** Id of the saved comparison, null when never saved. */
  readonly id = this._id.asReadonly();
  /** Editable comparison name. */
  readonly name = signal('Ma comparaison');
  /** Comparison content (settings + cars). */
  readonly data = this._data.asReadonly();
  /** True after any edit (data or name) since last load/save/new. */
  readonly dirty = computed(() => this.dataDirty() || this.name() !== this.baseName());
  /** True while a save/delete request is running. */
  readonly saving = this._saving.asReadonly();
  /** Last error message, or null. */
  readonly error = this._error.asReadonly();
  /** Computed results per car. */
  readonly results = computed(() => computeAll(this.data()));
  /** Cheapest result. */
  readonly best = computed(() => cheapest(this.results()));
  /** Saved comparisons as returned by the API. */
  readonly saved = computed<ComparisonSummary[]>(() => (this.savedRes.hasValue() ? this.savedRes.value() : []));

  /** Refetches the saved list. */
  reloadSaved(): void {
    this.savedRes.reload();
  }

  /**
   * Merges a patch into settings.
   * @param patch Fields to change.
   */
  updateSettings(patch: Partial<Settings>): void {
    this.edit((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }

  /**
   * Merges a patch into one car.
   * @param id Car id.
   * @param patch Fields to change.
   */
  updateCar(id: string, patch: Partial<Car>): void {
    this.edit((d) => ({ ...d, cars: d.cars.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }

  /** Appends a blank car. */
  addCar(): void {
    this.edit((d) => ({ ...d, cars: [...d.cars, newCar(d.cars.length + 1)] }));
  }

  /**
   * Removes a car.
   * @param id Car id.
   */
  removeCar(id: string): void {
    this.edit((d) => ({ ...d, cars: d.cars.filter((c) => c.id !== id) }));
  }

  /**
   * Duplicates a car right after the original.
   * @param id Car id.
   */
  duplicateCar(id: string): void {
    this.edit((d) => {
      const i = d.cars.findIndex((c) => c.id === id);
      if (i < 0) return d;
      const src = d.cars[i];
      const copy: Car = {
        ...src,
        id: crypto.randomUUID(),
        name: `${src.name} (copie)`,
        repairItems: src.repairItems.map((r) => ({ ...r })),
      };
      return { ...d, cars: [...d.cars.slice(0, i + 1), copy, ...d.cars.slice(i + 1)] };
    });
  }

  /**
   * Moves a car one slot left or right.
   * @param id Car id.
   * @param delta -1 or 1.
   */
  moveCar(id: string, delta: -1 | 1): void {
    this.edit((d) => {
      const i = d.cars.findIndex((c) => c.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= d.cars.length) return d;
      const cars = [...d.cars];
      [cars[i], cars[j]] = [cars[j], cars[i]];
      return { ...d, cars };
    });
  }

  /** Resets to the default comparison (unsaved). */
  newFromSeed(): void {
    this.apply(null, 'Ma comparaison', seedComparison());
  }

  /**
   * Loads a saved comparison.
   * @param id Comparison id.
   */
  async load(id: string): Promise<void> {
    try {
      const c = await this.api.get(id);
      this.apply(c.id, c.name, c.data);
    } catch (e) {
      this.fail(e, 'Chargement impossible');
    }
  }

  /** Saves (POST if new, else PUT); returns the id. */
  save(): Promise<string> {
    const id = this._id();
    return this.persist(() => (id ? this.api.update(id, this.name(), this.data()) : this.api.create(this.name(), this.data())));
  }

  /**
   * Saves a copy under a new name (always POST); the copy becomes current.
   * @param name Name of the copy.
   */
  saveAs(name: string): Promise<string> {
    return this.persist(() => this.api.create(name, this.data()));
  }

  /** Deletes the current comparison then resets to seed. */
  async remove(): Promise<void> {
    const id = this._id();
    if (!id) return;
    this._saving.set(true);
    this._error.set(null);
    try {
      await this.api.delete(id);
      this.newFromSeed();
      this.reloadSaved();
    } catch (e) {
      this.fail(e, 'Suppression impossible');
    } finally {
      this._saving.set(false);
    }
  }

  /** Clears the error banner. */
  clearError(): void {
    this._error.set(null);
  }

  /**
   * Runs a save request and syncs local state.
   * @param req Request factory.
   */
  private async persist(req: () => Promise<{ id: string; name: string }>): Promise<string> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const c = await req();
      this._id.set(c.id);
      this.name.set(c.name);
      this.baseName.set(c.name);
      this.dataDirty.set(false);
      this.reloadSaved();
      return c.id;
    } catch (e) {
      this.fail(e, 'Enregistrement impossible');
      throw e;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Applies an immutable data update and marks dirty.
   * @param fn Pure transform.
   */
  private edit(fn: (d: ComparisonData) => ComparisonData): void {
    this._data.update(fn);
    this.dataDirty.set(true);
  }

  /**
   * Replaces the whole state, clean.
   * @param id Saved id or null.
   * @param name Name.
   * @param data Content.
   */
  private apply(id: string | null, name: string, data: ComparisonData): void {
    this._id.set(id);
    this.name.set(name);
    this.baseName.set(name);
    this._data.set(data);
    this.dataDirty.set(false);
    this._error.set(null);
  }

  /**
   * Stores a user-facing error.
   * @param e Caught error.
   * @param msg Fallback message.
   */
  private fail(e: unknown, msg: string): void {
    this._error.set(`${msg}${e instanceof Error ? ` (${e.message})` : ''}`);
  }
}
