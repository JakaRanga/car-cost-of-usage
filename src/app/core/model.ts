/** Energy source of a car. */
export type Energy = 'electric' | 'diesel';

/** One possible repair, weighted by its yearly probability. */
export interface RepairItem {
  /** Free label, e.g. "Injecteurs". */
  label: string;
  /** Probability (0-100) that the repair happens in a given year. */
  probabilityPct: number;
  /** Cost of the repair in EUR. */
  cost: number;
}

/** A car taking part in a comparison. All recurring costs are per year. */
export interface Car {
  /** Stable client-side id (crypto.randomUUID()). */
  id: string;
  name: string;
  /** CSS color used in cards and charts. */
  color: string;
  energy: Energy;
  /** Already owned: no purchase, no trade-in deduction. */
  owned: boolean;
  /** Purchase price in EUR (non-owned cars). */
  price: number;
  /** Current market value in EUR (owned cars). */
  currentValue: number;
  /** Owned cars only: count future depreciation as a cost (opportunity cost). */
  includeDepreciation: boolean;
  /** kWh/100 km for electric, L/100 km for diesel. */
  consumption: number;
  /** Value at the end of the period, in % of price (or of currentValue when owned). */
  residualPct: number;
  /** Summer + winter tyres per year, EUR. */
  tyres: number;
  /** Scheduled maintenance per year, EUR. */
  maintenance: number;
  /** Repair provision per year, EUR; used only when repairItems is empty. */
  repairs: number;
  /** Expected-cost repair list (per year); when non-empty it replaces `repairs`. */
  repairItems: RepairItem[];
  /** Insurance per year, EUR. */
  insurancePerYear: number;
  /** Taxes, AdBlue, inspection, misc per year, EUR. */
  misc: number;
}

/** Global assumptions shared by every car. */
export interface Settings {
  kmPerYear: number;
  years: number;
  /** EUR/L. */
  dieselPrice: number;
  /** EUR/kWh at home. */
  homeKwhPrice: number;
  /** EUR/kWh on fast chargers. */
  fastKwhPrice: number;
  /** Share of energy charged at home, 0-100. */
  homeSharePct: number;
  /** AC charging losses, %, default 10. */
  chargingLossPct: number;
  /** Trade-in value of the owned car, deducted from every non-owned car's capital. */
  tradeIn: number;
  /** Trip distance for the charging-time panel, km. */
  tripKm: number;
  /** Charging powers for the charging-time panel, kW. */
  chargePowers: number[];
}

/** The editable content of a comparison. */
export interface ComparisonData {
  settings: Settings;
  cars: Car[];
}

/** A comparison as stored in MongoDB and returned by the API. */
export interface SavedComparison {
  id: string;
  name: string;
  data: ComparisonData;
  createdAt: string;
  updatedAt: string;
}

/** List entry returned by GET /api/comparisons. */
export interface ComparisonSummary {
  id: string;
  name: string;
  updatedAt: string;
}

/** Computed cost result for one car over the period (all EUR). */
export interface CarResult {
  car: Car;
  energy: number;
  /** kWh (electric, losses included) or litres (diesel) over the period. */
  energyUnits: number;
  tyres: number;
  maintenance: number;
  repairs: number;
  /** Insurance over the whole period. */
  insurance: number;
  misc: number;
  depreciation: number;
  /** Net capital tied up at start: price - tradeIn, or 0 when owned. */
  capital: number;
  /** Value at the end of the period. */
  resaleValue: number;
  total: number;
  annual: number;
  perKm: number;
}
