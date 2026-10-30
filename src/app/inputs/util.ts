import { Car } from '../core/model';

/** A numeric car field editable in both cards and grid. */
export interface NumField {
  /** Car property. */
  key: keyof Car & string;
  /** French label. */
  label: string;
  /** Input step. */
  step: number;
  /** Optional max (percent fields). */
  max?: number;
}

/** Numeric fields shared by every car, in display order (after consumption). */
export const COMMON_FIELDS: NumField[] = [
  { key: 'residualPct', label: 'Valeur résiduelle, %', step: 1, max: 100 },
  { key: 'tyres', label: 'Pneus été + hiver, €/an', step: 50 },
  { key: 'maintenance', label: 'Entretien programmé, €/an', step: 50 },
  { key: 'insurancePerYear', label: 'Assurance, €/an', step: 50 },
  { key: 'misc', label: 'Taxes et divers, €/an', step: 50 },
];

/**
 * Reads a numeric input value, ignoring NaN, clamped to [min, max].
 * @param e Input event.
 * @param min Lower bound.
 * @param max Upper bound.
 * @returns The clamped number or null when invalid.
 */
export function readNum(e: Event, min = 0, max = Number.POSITIVE_INFINITY): number | null {
  const v = (e.target as HTMLInputElement).valueAsNumber;
  return Number.isNaN(v) ? null : Math.min(max, Math.max(min, v));
}

/**
 * Consumption label for an energy.
 * @param c The car.
 */
export function consumptionLabel(c: Car): string {
  return c.energy === 'electric' ? 'Consommation, kWh/100 km' : 'Consommation, L/100 km';
}
