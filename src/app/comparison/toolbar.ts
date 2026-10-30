import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ComparisonStore } from '../core/comparison-store';

/** Sticky toolbar: name, save/new/copy/delete and saved comparisons list. */
@Component({
  selector: 'app-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sticky top-0 z-20 block pt-2' },
  template: `
    <div class="card-glass flex flex-wrap items-center justify-between gap-3 rounded-card border border-border p-3 shadow-pop sm:px-4">
      <div class="flex min-w-0 flex-[1_1_260px] items-center gap-3">
        <span class="size-2.5 flex-none rounded-full bg-border-strong transition data-[on=true]:animate-pulse-warn data-[on=true]:bg-warn data-[on=true]:shadow-[0_0_0_4px_rgb(251_191_36/0.2)]"
          [attr.data-on]="store.dirty()" title="Modifications non enregistrées"></span>
        <label class="sr-only" for="cmp-name">Nom de la comparaison</label>
        <input id="cmp-name" type="text" maxlength="120" placeholder="Nom de la comparaison"
          class="border-transparent bg-transparent px-2.5 py-1.5 font-display text-[1.05rem] font-bold hover:border-border"
          [value]="store.name()" (input)="store.name.set($any($event.target).value)" />
      </div>

      <div class="flex flex-wrap items-center gap-2 max-sm:w-full">
        <button type="button" class="btn max-sm:flex-auto" (click)="onNew()">Nouvelle</button>
        <button type="button" class="btn btn-primary max-sm:flex-auto" [disabled]="store.saving()" (click)="onSave()">
          {{ store.saving() ? 'Envoi...' : 'Enregistrer' }}
        </button>

        <details class="relative max-sm:flex-auto" #copyPop>
          <summary class="btn list-none [&::-webkit-details-marker]:hidden">Enregistrer une copie</summary>
          <form class="absolute top-[calc(100%+8px)] left-0 z-30 m-0 grid min-w-[280px] animate-reveal-fast gap-2 rounded-card border border-border-strong bg-card p-3 shadow-pop max-sm:fixed max-sm:inset-x-3 max-sm:top-auto max-sm:mt-2 max-sm:min-w-0" (submit)="onCopy($event, copyName.value)">
            <label for="copy-name" class="text-muted">Nom de la copie</label>
            <input #copyName id="copy-name" type="text" required maxlength="120" [value]="store.name() + ' (copie)'" />
            <button type="submit" class="btn btn-primary" [disabled]="store.saving()">Créer la copie</button>
          </form>
        </details>

        @if (store.id()) {
          <button type="button" class="btn btn-danger max-sm:flex-auto" [disabled]="store.saving()" (click)="onDelete()">Supprimer</button>
        }

        <details class="relative max-sm:flex-auto" #listPop>
          <summary class="btn list-none [&::-webkit-details-marker]:hidden">Mes comparaisons <span class="chip">{{ store.saved().length }}</span></summary>
          <ul class="absolute top-[calc(100%+8px)] right-0 z-30 m-0 max-h-[60vh] min-w-[320px] animate-reveal-fast list-none overflow-y-auto rounded-card border border-border-strong bg-card p-1 shadow-pop max-sm:fixed max-sm:inset-x-3 max-sm:top-auto max-sm:mt-2 max-sm:min-w-0">
            @for (s of store.saved(); track s.id) {
              <li>
                <button type="button" class="flex w-full cursor-pointer justify-between gap-3 rounded-sm px-2.5 py-2 text-left hover:bg-accent/10 data-[current=true]:shadow-[inset_3px_0_var(--color-accent)]"
                  [attr.data-current]="s.id === store.id()" (click)="open(s.id)">
                  <span class="truncate font-semibold">{{ s.name }}</span>
                  <span class="flex-none self-center font-mono text-xs font-medium text-muted">{{ formatDate(s.updatedAt) }}</span>
                </button>
              </li>
            } @empty {
              <li class="p-3 text-muted">Aucune comparaison enregistrée.</li>
            }
          </ul>
        </details>
      </div>
    </div>

    @if (store.error(); as err) {
      <div class="mt-2 flex animate-reveal-fast items-center justify-between gap-3 rounded-sm border border-danger bg-red-900/85 px-4 py-3 text-red-200 backdrop-blur-sm" role="alert">
        <span>{{ err }}</span>
        <button type="button" class="btn btn-ghost btn-sm" (click)="store.clearError()" aria-label="Fermer">x</button>
      </div>
    }
`,
})
export class Toolbar {
  /** Shared comparison store. */
  protected readonly store = inject(ComparisonStore);
  /** Router for navigation after save/open. */
  private readonly router = inject(Router);
  /** "Copy" popover, closed after use. */
  private readonly copyPop = viewChild<ElementRef<HTMLDetailsElement>>('copyPop');
  /** Saved-list popover, closed after use. */
  private readonly listPop = viewChild<ElementRef<HTMLDetailsElement>>('listPop');
  /** Date formatter for the saved list. */
  private readonly fmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  /**
   * Ctrl+S / Cmd+S saves.
   * @param e Keyboard event.
   */
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void this.onSave();
    }
  }

  /**
   * Formats an ISO date for display.
   * @param iso ISO date string.
   */
  formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : this.fmt.format(d);
  }

  /** Asks before discarding unsaved edits; true when it is safe to continue. */
  private canDiscard(): boolean {
    return !this.store.dirty() || confirm('Modifications non enregistrées. Continuer et les perdre ?');
  }

  /** Starts a fresh comparison. */
  onNew(): void {
    if (!this.canDiscard()) return;
    this.store.newFromSeed();
    void this.router.navigate(['/']);
  }

  /** Saves and navigates to the saved comparison. */
  async onSave(): Promise<void> {
    try {
      const id = await this.store.save();
      await this.router.navigate(['/c', id]);
    } catch {
      /* error already exposed through store.error() */
    }
  }

  /**
   * Saves a copy under the typed name.
   * @param e Submit event.
   * @param name Name typed by the user.
   */
  async onCopy(e: Event, name: string): Promise<void> {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const id = await this.store.saveAs(name.trim());
      this.copyPop()?.nativeElement.removeAttribute('open');
      await this.router.navigate(['/c', id]);
    } catch {
      /* error already exposed through store.error() */
    }
  }

  /** Deletes the current comparison after confirmation. */
  async onDelete(): Promise<void> {
    if (!confirm(`Supprimer définitivement "${this.store.name()}" ?`)) return;
    await this.store.remove();
    if (!this.store.error()) await this.router.navigate(['/']);
  }

  /**
   * Opens a saved comparison.
   * @param id Comparison id.
   */
  open(id: string): void {
    this.listPop()?.nativeElement.removeAttribute('open');
    if (id === this.store.id() || !this.canDiscard()) return;
    void this.router.navigate(['/c', id]);
  }
}
