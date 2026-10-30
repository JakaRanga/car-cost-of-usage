import { Car, ComparisonData } from './model';

/** Palette of vivid, distinct colors for new cars. */
const PALETTE = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#a855f7', '#14b8a6', '#ec4899', '#84cc16'];

/**
 * Builds a car from partial values on top of a blank electric car.
 * @param p Overrides.
 */
function car(p: Partial<Car>): Car {
  return {
    id: crypto.randomUUID(),
    name: '',
    color: PALETTE[0],
    energy: 'electric',
    owned: false,
    price: 0,
    currentValue: 0,
    includeDepreciation: false,
    consumption: 16,
    residualPct: 50,
    tyres: 0,
    maintenance: 0,
    repairs: 0,
    repairItems: [],
    insurancePerYear: 0,
    misc: 0,
    ...p,
  };
}

/** Returns a fresh comparison with the default values of the original comparatif. */
export function seedComparison(): ComparisonData {
  const r = (label: string, probabilityPct: number, cost: number) => ({ label, probabilityPct, cost });
  const ev = (a: number, b: number, c: number) => [
    r('Électronique, écran, caméras, ADAS', 100, a),
    r('Chargeur embarqué / câble / connectique', 100, b),
    r('Divers hors garantie', 100, c),
  ];
  return {
    settings: {
      kmPerYear: 35000,
      years: 5,
      dieselPrice: 2.054,
      homeKwhPrice: 0.2,
      fastKwhPrice: 0.35,
      homeSharePct: 85,
      chargingLossPct: 10,
      tradeIn: 18000,
      tripKm: 150,
      chargePowers: [3.7, 7.4, 11],
    },
    cars: [
      car({
        name: 'Tesla Model 3 Grande Autonomie Propulsion', color: '#ef4444', price: 45990, consumption: 16,
        residualPct: 40, tyres: 800, maintenance: 400, repairs: 300, insurancePerYear: 1325, misc: 150,
        repairItems: ev(100, 85, 115),
      }),
      car({
        name: 'XPeng P7+ 20"', color: '#22c55e', price: 43000, consumption: 20, residualPct: 35,
        tyres: 1250, maintenance: 450, repairs: 400, insurancePerYear: 1600, misc: 150,
        repairItems: ev(150, 100, 150),
      }),
      car({
        name: 'Renault Talisman Blue dCi 200', color: '#f59e0b', energy: 'diesel', owned: true, price: 0,
        currentValue: 15500, includeDepreciation: false, consumption: 6, residualPct: 35, tyres: 975,
        maintenance: 900, repairs: 1073, insurancePerYear: 1150, misc: 375,
        repairItems: [
          r('FAP / régénération / capteur pression', 10, 1200),
          r("Vanne EGR / circuit d'air", 13, 600),
          r('Injecteurs', 8, 2000),
          r('Turbo / actuateur', 5, 1800),
          r('Boîte EDC / embrayage / mécatronique', 3, 3500),
          r('Refroidissement, capteurs, électronique, divers', 100, 500),
        ],
      }),
    ],
  };
}

/**
 * Returns a blank electric car with a color cycled from the palette.
 * @param index 1-based position of the car in the comparison.
 */
export function newCar(index: number): Car {
  return car({ name: `Voiture ${index}`, color: PALETTE[(((index - 1) % 8) + 8) % 8] });
}
