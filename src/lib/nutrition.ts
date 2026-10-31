import { supabase } from './supabase';
import { DEFAULT_DENSITY_G_PER_ML, G_PER_UNIT, ML_PER_UNIT } from '../data/units';
import type { Ingredient } from './types';
import { defaultPrep, matchFood, words } from './match';
import { parseIngredientLine } from '../../supabase/functions/_shared/parse';
import { isStockCube, standardPieceWeight, STOCK_CUBE_SALT_G } from '../data/pieceWeights';

export type { LvFood } from './match';
import type { LvFood } from './match';
export type Per100 = Partial<Record<'kcal' | 'protein' | 'fat' | 'carbs' | 'fiber' | 'sugar' | 'satfat' | 'salt' | 'vitd' | 'b12' | 'vitc' | 'folate' | 'iron' | 'calcium' | 'iodine' | 'selenium', number>>;

// ── Livsmedelslistan (cachas i minnet) ──
let listPromise: Promise<LvFood[]> | null = null;

async function readList(): Promise<LvFood[]> {
  const out: LvFood[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase.from('lv_foods').select('id,name').order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...(data as LvFood[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Felmeddelandet från en Edge Function, inte bara "non-2xx status code". */
export async function functionError(error: unknown): Promise<Error> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try { const body = await ctx.json(); if (body?.error) return new Error(String(body.error)); } catch { /* inte JSON */ }
  }
  return error instanceof Error ? error : new Error(String(error));
}

export function foodList(): Promise<LvFood[]> {
  if (!listPromise) {
    listPromise = (async () => {
      let list = await readList();
      if (list.length < 100) {
        const { data, error } = await supabase.functions.invoke('lv-foods', { body: { action: 'sync', force: true } });
        if (error) throw await functionError(error);
        list = await readList();
        if (list.length < 100) throw new Error(`Livsmedelslistan från Livsmedelsverket är tom (hämtade ${data?.synced ?? 0} livsmedel).`);
      }
      return list;
    })().catch((e) => { listPromise = null; throw e; });
  }
  return listPromise;
}

// ── Matchning mot livsmedelsnamn (se match.ts) ──
export { matchFood };

/**
 * Matchar ingredienser utan livsmedel, och matchar om automatiska kopplingar som inte
 * håller enligt nuvarande regler (t.ex. "salt" → "Saltsill"). Ingredienser där måttet
 * hamnat i namnet ("1,5 liter vatten") rättas samtidigt.
 */
export async function matchMissing(ingredients: Ingredient[], update: (id: number, p: Partial<Ingredient>) => Promise<void>) {
  const fixed = ingredients.map((i) => {
    if (i.unit || i.amount == null) return { i, patch: {} as Partial<Ingredient> };
    const p = parseIngredientLine(`${i.amount} ${i.name}`);
    return p.unit ? { i: { ...i, unit: p.unit, name: p.name }, patch: { unit: p.unit, name: p.name } as Partial<Ingredient> } : { i, patch: {} };
  });
  const stale = (i: Ingredient) => {
    if (i.lv_food_id == null || i.lv_food_name == null) return false;
    if (!matchFood(i.name, [{ id: i.lv_food_id, name: i.lv_food_name }])) return true;
    // Osäkra träffar prövas igen: en bättre kan finnas med nuvarande regler.
    if (i.match_confidence === 'unsure') return true;
    // Kopplad till fel tillagning, t.ex. rå potatis när potatis ska räknas som kokt.
    const prep = defaultPrep(i.name);
    return !!prep && !words(i.lv_food_name).includes(prep);
  };
  // Buljongtärningar räknas bara som salt och behöver inget livsmedel.
  const todo = fixed.filter(({ i, patch }) => !isStockCube(i.name, i.unit) && (i.lv_food_id == null || stale(i) || Object.keys(patch).length));
  if (!todo.length) return;
  const foods = await foodList();
  await Promise.all(todo.map(({ i, patch }) => {
    if (i.lv_food_id != null && !stale(i)) return update(i.id, patch);
    const m = matchFood(i.name, foods);
    // Samma livsmedel som redan är kopplat (t.ex. ingen kokt potatis i databasen): skriv inte igen.
    if (m && m.food.id === i.lv_food_id) return Object.keys(patch).length ? update(i.id, patch) : Promise.resolve();
    if (m) return update(i.id, { ...patch, lv_food_id: m.food.id, lv_food_name: m.food.name, match_confidence: m.sure ? 'sure' : 'unsure' });
    // Redan markerad utan träff och inget att rätta: skriv inte igen.
    if (i.lv_food_id == null && i.match_confidence != null && !Object.keys(patch).length) return Promise.resolve();
    return update(i.id, { ...patch, lv_food_id: null, lv_food_name: null, match_confidence: 'unsure' });
  }));
}

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

/** Kryddor, salt och vatten: försumbar näring, och appen frågar aldrig efter vikt för dem. */
export function isNegligible(i: Ingredient): boolean {
  const core = coreName(i.name);
  return ['tsk', 'krm', 'nypa'].includes(i.unit.toLowerCase()) || WATER.has(core) || SEASONING.has(core) || /krydd/.test(core);
}

/** Näringsvärden per livsmedel, plus eventuella fel från Livsmedelsverket per livsmedel. */
export async function fetchNutrients(ids: number[]): Promise<{ map: Map<number, Per100>; errors: string[] }> {
  const map = new Map<number, Per100>();
  if (!ids.length) return { map, errors: [] };
  const { data, error } = await supabase.functions.invoke('lv-foods', { body: { action: 'nutrients', ids } });
  if (error) throw await functionError(error);
  for (const f of (data?.foods ?? []) as { id: number; per_100g: Per100 | null }[]) if (f.per_100g) map.set(f.id, f.per_100g);
  return { map, errors: Object.values((data?.errors ?? {}) as Record<string, string>) };
}

const VOLUME = (u: string) => ML_PER_UNIT[u] != null;
/** Enheten som en vikt sparas under: volym som dl, tom enhet som st. */
export const weightUnit = (unit: string) => {
  const u = unit.toLowerCase().trim();
  return VOLUME(u) ? 'dl' : u || 'st';
};

/** Vikter per enhet: köket egna går före den gemensamma tabellen. */
export async function fetchUnitWeights(ids: number[], householdId?: string) {
  const map = new Map<string, number>();
  if (!ids.length) return map;
  const { data } = await supabase.from('unit_weights').select('lv_food_id,unit,grams').in('lv_food_id', ids);
  for (const w of data ?? []) map.set(`${w.lv_food_id}:${w.unit}`, Number(w.grams));
  if (householdId) {
    const { data: own } = await supabase.from('household_unit_weights').select('lv_food_id,unit,grams')
      .eq('household_id', householdId).in('lv_food_id', ids);
    for (const w of own ?? []) map.set(`${w.lv_food_id}:${w.unit}`, Number(w.grams));
  }
  return map;
}

/** Sparar köket vikt för 1 enhet av livsmedlet (volym räknas om till 1 dl). */
export async function saveUnitWeight(householdId: string, lvFoodId: number, unit: string, gramsPerUnit: number) {
  const u = unit.toLowerCase().trim();
  const key = weightUnit(u);
  const grams = VOLUME(u) ? gramsPerUnit * 100 / ML_PER_UNIT[u] : gramsPerUnit;
  const { error } = await supabase.from('household_unit_weights')
    .upsert({ household_id: householdId, lv_food_id: lvFoodId, unit: key, grams, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

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
    return { grams: i.amount * ML_PER_UNIT[u] * DEFAULT_DENSITY_G_PER_ML, assumed: true };
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
    if ((i.amount == null && i.grams == null) || isWater(i) || (!food && i.lv_food_id == null && isNegligible(i))) { ignored.push(i); continue; }
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

/** Uppskattad energi per portion för granskningsvyn (innan receptet är sparat). */
export async function estimateKcal(lines: { amount: number | null; unit: string; name: string }[], portions: number): Promise<number | null> {
  if (!lines.length) return null;
  const foods = await foodList();
  const ings: Ingredient[] = lines.map((l, k) => {
    const m = matchFood(l.name, foods);
    return { id: k, recipe_id: '', position: k, amount: l.amount, unit: l.unit, name: l.name, grams: null,
      lv_food_id: m?.food.id ?? null, lv_food_name: m?.food.name ?? null, match_confidence: m ? (m.sure ? 'sure' : 'unsure') : null };
  });
  const ids = [...new Set(ings.map((i) => i.lv_food_id).filter((x): x is number => x != null))];
  const [f, w] = await Promise.all([fetchNutrients(ids), fetchUnitWeights(ids)]);
  const res = computeNutrition(ings, portions, f.map, w);
  return res.counted ? Math.round(res.perPortion.kcal ?? 0) : null;
}
