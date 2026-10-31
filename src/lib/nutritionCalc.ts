// Ren beräkning av näringsvärde: inga databasanrop, så att den kan testas direkt.
import { DEFAULT_DENSITY_G_PER_ML, G_PER_UNIT, ML_PER_UNIT } from '../data/units.ts';
import { isStockCube, standardCanWeight, standardDlWeight, standardPieceWeight, STOCK_CUBE_SALT_G } from '../data/pieceWeights.ts';
import type { Ingredient } from './types.ts';

export type Per100 = Partial<Record<'kcal' | 'protein' | 'fat' | 'carbs' | 'fiber' | 'sugar' | 'satfat' | 'salt' | 'vitd' | 'b12' | 'vitc' | 'folate' | 'iron' | 'calcium' | 'iodine' | 'selenium', number>>;

// Beskrivande ord som tas bort innan namnet jämförs ("kallt vatten", "nymalen svartpeppar").
const MODIFIERS = new Set(['torkad', 'torkade', 'färsk', 'färska', 'malen', 'mald', 'nymalen', 'grovmalen', 'hel', 'hela', 'efter', 'smak',
  'ev', 'eventuellt', 'kallt', 'kall', 'ljummet', 'ljummen', 'varmt', 'varm', 'hett', 'kokande', 'kokt', 'lite', 'en', 'nypa', 'till', 'servering']);
const coreName = (name: string) => name.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[,.]/g, ' ')
  .split(/\s+/).filter((w) => w && !MODIFIERS.has(w)).join(' ');

const WATER = new Set(['vatten', 'kranvatten', 'kokvatten', 'isvatten', 'isbitar', 'is']);
const SEASONING = new Set(['salt', 'flingsalt', 'havssalt', 'bordssalt', 'peppar', 'svartpeppar', 'vitpeppar', 'kryddpeppar',
  'cayennepeppar', 'lagerblad', 'salt och peppar', 'salt och svartpeppar']);

/** Vatten räknas aldrig: ingen energi, oavsett vilket livsmedel det kopplats till. */
export const isWater = (i: Ingredient) => WATER.has(coreName(i.name));

// Kryddor räknas aldrig: försumbar näring i de mängder som används, och de matchas
// lätt fel (paprikapulver → paprika, chilipulver → chilisås).
const SPICE = /(pulver|flakes|krydda|kryddor|kryddmix|^curry$|oregano|timjan|mejram|rosmarin|spiskummin|kummin|kanel|kardemumma|gurkmeja|muskot|kryddnejlika|lagerblad|vaniljsocker|vaniljpulver|vaniljstång|saffran|peppar$|^peppar|chiliflakes|cayenne|garam masala|fänkålsfrö|korianderfrö|senapsfrö)/;
// Färska örter i kruka eller knippe ger försumbar näring och saknar standardvikt.
const HERB_BUNCH = /(^|\s)(knippe|knippa|kruka|krukor)(\s|$)/;
export const isSpice = (i: Ingredient) => SPICE.test(coreName(i.name)) || HERB_BUNCH.test(i.name.toLowerCase()) || /^kruk/.test(i.unit.toLowerCase());

/** Kryddor, salt och vatten: försumbar näring, och appen frågar aldrig efter vikt för dem. */
export function isNegligible(i: Ingredient): boolean {
  const core = coreName(i.name);
  return ['tsk', 'krm', 'nypa'].includes(i.unit.toLowerCase()) || WATER.has(core) || SEASONING.has(core) || isSpice(i);
}


const VOLUME = (u: string) => ML_PER_UNIT[u] != null;
/** Enheten som en vikt sparas under: volym som dl, tom enhet som st. */
export const weightUnit = (unit: string) => {
  const u = unit.toLowerCase().trim();
  return VOLUME(u) ? 'dl' : u || 'st';
};


/** Mängd → gram. null om vikt saknas (t.ex. "1 st" utan känd styckvikt). */
export function toGrams(i: Ingredient, weights: Map<string, number>): { grams: number | null; assumed: boolean; standard?: boolean } {
  if (i.grams != null) return { grams: i.grams, assumed: false };
  if (i.amount == null) return { grams: null, assumed: false };
  const u = i.unit.toLowerCase().trim() || 'st';
  if (G_PER_UNIT[u]) return { grams: i.amount * G_PER_UNIT[u], assumed: false };
  const own = i.lv_food_id != null ? weights.get(`${i.lv_food_id}:${u}`) : undefined;
  if (own) return { grams: i.amount * own, assumed: false };
  if (ML_PER_UNIT[u]) {
    const perDl = i.lv_food_id != null ? weights.get(`${i.lv_food_id}:dl`) : undefined;
    if (perDl) return { grams: i.amount * ML_PER_UNIT[u] / 100 * perDl, assumed: false };
    const std = standardDlWeight(i.name);
    if (std) return { grams: i.amount * ML_PER_UNIT[u] / 100 * std.grams, assumed: false, standard: true };
    return { grams: i.amount * ML_PER_UNIT[u] * DEFAULT_DENSITY_G_PER_ML, assumed: true };
  }
  if (u === 'burk') {
    const can = standardCanWeight(i.name);
    if (can) return { grams: i.amount * can.grams, assumed: false, standard: true };
  }
  if (u === 'st') {
    const std = standardPieceWeight(i.name);
    if (std) return { grams: i.amount * std.grams, assumed: false, standard: true };
  }
  return { grams: null, assumed: false };
}

export interface NutResult {
  perPortion: Per100;
  counted: number;
  noWeight: Ingredient[];
  noFood: Ingredient[];
  assumedDensity: number;
  assumed: Ingredient[];
  standard: Ingredient[];
  ignored: Ingredient[];
  stockCubes: Ingredient[];
  /** Salt per portion och ingrediens, störst först. */
  saltBy: { name: string; grams: number }[];
}

export function computeNutrition(ingredients: Ingredient[], portions: number, foods: Map<number, Per100>, weights: Map<string, number>): NutResult {
  const sum: Per100 = {};
  const noWeight: Ingredient[] = [];
  const noFood: Ingredient[] = [];
  let counted = 0, assumedDensity = 0;
  const assumed: Ingredient[] = [];
  const standard: Ingredient[] = [];
  const ignored: Ingredient[] = [];
  const stockCubes: Ingredient[] = [];
  const saltRaw: { name: string; grams: number }[] = [];
  for (const i of ingredients) {
    // Buljongtärningar: bara salt, inget annat.
    if (i.amount != null && isStockCube(i.name, i.unit)) {
      sum.salt = (sum.salt ?? 0) + i.amount * STOCK_CUBE_SALT_G;
      saltRaw.push({ name: i.name, grams: i.amount * STOCK_CUBE_SALT_G });
      stockCubes.push(i);
      continue;
    }
    const food = i.lv_food_id != null ? foods.get(i.lv_food_id) : undefined;
    // Utan mängd går det inte att räkna; kryddor m.m. som saknas i databasen är försumbara.
    if ((i.amount == null && i.grams == null) || isWater(i) || isSpice(i) || (!food && i.lv_food_id == null && isNegligible(i))) { ignored.push(i); continue; }
    if (!food) { noFood.push(i); continue; }
    const g = toGrams(i, weights);
    if (g.grams == null) { noWeight.push(i); continue; }
    if (g.assumed) { assumedDensity++; assumed.push(i); }
    if (g.standard) standard.push(i);
    counted++;
    for (const [k, v] of Object.entries(food)) {
      if (typeof v !== 'number') continue;
      const key = k as keyof Per100;
      sum[key] = (sum[key] ?? 0) + g.grams / 100 * v;
    }
    if (food.salt) saltRaw.push({ name: i.name, grams: g.grams / 100 * food.salt });
  }
  const p = Math.max(1, portions);
  const perPortion: Per100 = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, v / p]));
  const saltBy = saltRaw.map((x) => ({ name: x.name, grams: x.grams / p })).filter((x) => x.grams >= 0.05).sort((a, b) => b.grams - a.grams);
  return { perPortion, counted, noWeight, noFood, assumedDensity, assumed, standard, ignored, stockCubes, saltBy };
}

