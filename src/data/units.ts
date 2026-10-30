// Svenska standardmått. 1 msk = 15 ml, 1 tsk = 5 ml, 1 krm = 1 ml.
export const ML_PER_UNIT: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000, msk: 15, tsk: 5, krm: 1 };
export const G_PER_UNIT: Record<string, number> = { g: 1, kg: 1000 };
// Densitet när livsmedlet saknar egen vikt i tabellen unit_weights.
// Det här är ett antagande (vattnets densitet) och redovisas i fotnoten.
export const DEFAULT_DENSITY_G_PER_ML = 1;
