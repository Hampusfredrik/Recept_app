// Svenska standardmått. 1 msk = 15 ml, 1 tsk = 5 ml, 1 krm = 1 ml.
export const ML_PER_UNIT: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000, msk: 15, tsk: 5, krm: 1,
  // Amerikanska mått för engelska recept (NIST: 1 cup = 236,5882365 ml, 1 tbsp = 14,78676478 ml, 1 tsp = 4,928921594 ml).
  cup: 236.5882365, cups: 236.5882365, tbsp: 14.78676478, tsp: 4.928921594 };
export const G_PER_UNIT: Record<string, number> = { g: 1, kg: 1000,
  // Avoirdupois (NIST: 1 oz = 28,349523125 g, 1 lb = 453,59237 g).
  oz: 28.349523125, lb: 453.59237 };
// Densitet när livsmedlet saknar egen vikt i tabellen unit_weights.
// Det här är ett antagande (vattnets densitet) och redovisas i fotnoten.
export const DEFAULT_DENSITY_G_PER_ML = 1;
