import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ComparisonData, ComparisonSummary, SavedComparison } from './model';

/** Thin HTTP client for /api/comparisons. */
@Injectable({ providedIn: 'root' })
export class ComparisonApi {
  /** Angular HTTP client. */
  private readonly http = inject(HttpClient);

  /** Lists saved comparisons (summaries). */
  list(): Promise<ComparisonSummary[]> {
    return firstValueFrom(this.http.get<ComparisonSummary[]>('/api/comparisons'));
  }

  /**
   * Fetches one comparison.
   * @param id Comparison id.
   */
  get(id: string): Promise<SavedComparison> {
    return firstValueFrom(this.http.get<SavedComparison>(`/api/comparisons/${encodeURIComponent(id)}`));
  }

  /**
   * Creates a comparison.
   * @param name Display name.
   * @param data Comparison content.
   */
  create(name: string, data: ComparisonData): Promise<SavedComparison> {
    return firstValueFrom(this.http.post<SavedComparison>('/api/comparisons', { name, data }));
  }

  /**
   * Replaces a comparison.
   * @param id Comparison id.
   * @param name Display name.
   * @param data Comparison content.
   */
  update(id: string, name: string, data: ComparisonData): Promise<SavedComparison> {
    return firstValueFrom(this.http.put<SavedComparison>(`/api/comparisons/${encodeURIComponent(id)}`, { name, data }));
  }

  /**
   * Deletes a comparison.
   * @param id Comparison id.
   */
  delete(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/comparisons/${encodeURIComponent(id)}`));
  }
}
