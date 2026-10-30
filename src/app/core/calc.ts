import { Car, CarResult, ComparisonData, Settings } from './model';

/**
 * Yearly repair provision: probability-weighted items when present, else the lump sum.
 * @param car The car.
 */
export function repairProvision(car: Car): number {
  return car.repairItems.length
    ? car.repairItems.reduce((s, i) => s + (i.probabilityPct / 100) * i.cost, 0)
    : car.repairs;
}

/**
 * Energy cost over a distance.
 * @param car The car.
 * @param s Global settings.
 * @param km Distance in km.
 * @returns Cost in EUR and units (kWh with losses, or litres).
 */
export function energyCost(car: Car, s: Settings, km: number): { cost: number; units: number } {
  if (car.energy === 'diesel') {
    const units = (km * car.consumption) / 100;
    return { cost: units * s.dieselPrice, units };
  }
  const units = ((km * car.consumption) / 100) * (1 + s.chargingLossPct / 100);
  const share = Math.min(100, Math.max(0, s.homeSharePct)) / 100;
  return { cost: units * (s.homeKwhPrice * share + s.fastKwhPrice * (1 - share)), units };
}

/**
 * Computes the full cost breakdown of one car over the period.
 * @param car The car.
 * @param s Global settings.
 */
export function computeCar(car: Car, s: Settings): CarResult {
  const km = s.kmPerYear * s.years;
  const e = energyCost(car, s, km);
  let capital: number, resaleValue: number, depreciation: number;
  if (car.owned) {
    capital = car.includeDepreciation ? car.currentValue : 0;
    resaleValue = (car.currentValue * car.residualPct) / 100;
    depreciation = car.includeDepreciation ? car.currentValue - resaleValue : 0;
  } else {
    capital = car.price - s.tradeIn;
    resaleValue = (car.price * car.residualPct) / 100;
    depreciation = capital - resaleValue;
  }
  const y = s.years;
  const tyres = car.tyres * y;
  const maintenance = car.maintenance * y;
  const repairs = repairProvision(car) * y;
  const insurance = car.insurancePerYear * y;
  const misc = car.misc * y;
  const total = e.cost + tyres + maintenance + repairs + insurance + misc + depreciation;
  return {
    car, energy: e.cost, energyUnits: e.units, tyres, maintenance, repairs,
    insurance, misc, depreciation, capital, resaleValue, total,
    annual: s.years > 0 ? total / s.years : 0,
    perKm: km > 0 ? total / km : 0,
  };
}

/**
 * Computes every car of a comparison.
 * @param data The comparison.
 */
export function computeAll(data: ComparisonData): CarResult[] {
  return data.cars.map((c) => computeCar(c, data.settings));
}

/**
 * Cheapest result by total cost.
 * @param results Computed results.
 */
export function cheapest(results: CarResult[]): CarResult | undefined {
  return results.reduce<CarResult | undefined>((b, r) => (!b || r.total < b.total ? r : b), undefined);
}

/**
 * Cumulative cash out by year (index 0 = capital); last value equals the total.
 * @param r Car result.
 * @param s Global settings.
 */
export function cumulativeByYear(r: CarResult, s: Settings): number[] {
  const running = r.total - r.depreciation;
  const credit = !r.car.owned || r.car.includeDepreciation;
  const out = [r.capital];
  for (let y = 1; y <= s.years; y++) {
    out.push(out[y - 1] + running / s.years - (y === s.years && credit ? r.resaleValue : 0));
  }
  return out;
}

/**
 * Cost of each year (1..years), from the cumulative series.
 * @param r Car result.
 * @param s Global settings.
 */
export function yearlyCosts(r: CarResult, s: Settings): number[] {
  const c = cumulativeByYear(r, s);
  return c.slice(1).map((v, i) => v - c[i]);
}

/**
 * Total cost of a car for each yearly distance.
 * @param car The car.
 * @param s Global settings.
 * @param kmValues Yearly distances to test.
 */
export function sensitivity(car: Car, s: Settings, kmValues: number[]): number[] {
  const base = computeCar(car, s);
  const baseKm = s.kmPerYear * s.years;
  return kmValues.map((k) => {
    const km = k * s.years;
    const f = baseKm > 0 ? km / baseKm : 0;
    // ponytail: linear wear model, per-item km curves if ever needed
    const wear = (base.tyres + base.maintenance + base.repairs) * f;
    return energyCost(car, s, km).cost + wear + base.insurance + base.misc + base.depreciation;
  });
}

/** Default yearly distances for the sensitivity chart: 10000..60000 step 5000. */
export function defaultKmRange(): number[] {
  return Array.from({ length: 11 }, (_, i) => 10000 + i * 5000);
}

/**
 * Reference result to compare a car against: the owned car, else the cheapest other.
 * @param car The car being compared.
 * @param results Computed results.
 */
export function referenceFor(car: Car, results: CarResult[]): CarResult | undefined {
  const others = results.filter((r) => r.car !== car);
  return others.find((r) => r.car.owned) ?? cheapest(others);
}

/**
 * Purchase price at which a non-owned car matches the reference total.
 * @param r Car result.
 * @param ref Reference result.
 * @param s Global settings.
 * @returns The price, or null if not applicable or negative.
 */
export function breakEvenPrice(r: CarResult, ref: CarResult, s: Settings): number | null {
  if (r.car.owned || r.car.residualPct >= 100) return null;
  const p = (ref.total - (r.total - r.depreciation) + s.tradeIn) / (1 - r.car.residualPct / 100);
  return p < 0 ? null : p;
}

/**
 * Hours needed to charge the trip distance at a given power.
 * @param car The car.
 * @param s Global settings.
 * @param powerKw Charging power in kW.
 * @returns Hours, or null for diesel or non-positive power.
 */
export function chargingHours(car: Car, s: Settings, powerKw: number): number | null {
  if (car.energy !== 'electric' || powerKw <= 0) return null;
  return (((s.tripKm * car.consumption) / 100) * (1 + s.chargingLossPct / 100)) / powerKw;
}

const eur0 = new Intl.NumberFormat('fr-LU', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('fr-LU', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Formats EUR with no decimals.
 * @param n Amount.
 */
export function formatEur(n: number): string {
  return eur0.format(n);
}

/**
 * Formats EUR with 2 decimals.
 * @param n Amount.
 */
export function formatEur2(n: number): string {
  return eur2.format(n);
}

/**
 * Formats hours as "7 h 08".
 * @param h Hours.
 */
export function formatHours(h: number): string {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
