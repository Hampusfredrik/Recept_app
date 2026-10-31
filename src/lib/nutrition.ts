import { supabase } from './supabase';
import { DEFAULT_DENSITY_G_PER_ML, G_PER_UNIT, ML_PER_UNIT } from '../data/units';
import type { Ingredient } from './types';
import { standardPieceWeight } from '../data/pieceWeights';

export interface LvFood { id: number; name: string }
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

// ── Matchning: fritext mot livsmedelsnamn ──
const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/[^a-zåäöéü\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 2);
const FILLER = new Set(['färsk', 'färska', 'hackad', 'hackade', 'riven', 'rivna', 'skalade', 'skalad', 'fint', 'grovt', 'gärna', 'eller', 'och', 'till', 'med', 'av', 'ca', 'gul', 'röd', 'stor', 'stora', 'liten', 'små']);
const pre = (w: string) => w.slice(0, 5);
const wordMatch = (a: string, b: string) => a.length >= 3 && b.length >= 3 && (b.startsWith(pre(a)) || a.startsWith(pre(b)));

export function matchFood(ingredient: string, foods: LvFood[]): { food: LvFood; sure: boolean } | null {
  const all = norm(ingredient);
  const words = all.filter((w) => !FILLER.has(w));
  const keys = words.length ? words : all;
  if (!keys.length) return null;
  let best: { food: LvFood; score: number; covered: number; head: boolean } | null = null;
  for (const f of foods) {
    const fw = norm(f.name);
    if (!fw.length) continue;
    const covered = keys.filter((w) => fw.some((x) => wordMatch(w, x))).length;
    if (!covered) continue;
    const head = keys.some((w) => wordMatch(w, fw[0]));
    const extra = all.filter((w) => FILLER.has(w) && fw.includes(w)).length; // t.ex. "gul" i "Lök gul rå"
    const score = covered / keys.length * 10 + (head ? 4 : 0) + extra + (fw.includes('rå') ? 0.5 : 0) - fw.length * 0.3;
    if (!best || score > best.score) best = { food: f, score, covered, head };
  }
  if (!best) return null;
  return { food: best.food, sure: best.covered === keys.length && best.head };
}

/** Matchar ingredienser som saknar livsmedel och sparar resultatet. */
export async function matchMissing(ingredients: Ingredient[], update: (id: number, p: Partial<Ingredient>) => Promise<void>) {
  // Ingredienser utan livsmedel matchas om varje gång: listan kan ha fyllts på sedan sist.
  const todo = ingredients.filter((i) => i.lv_food_id == null);
  if (!todo.length) return;
  const foods = await foodList();
  await Promise.all(todo.map((i) => {
    const m = matchFood(i.name, foods);
    if (m) return update(i.id, { lv_food_id: m.food.id, lv_food_name: m.food.name, match_confidence: m.sure ? 'sure' : 'unsure' });
    return i.match_confidence == null ? update(i.id, { match_confidence: 'unsure' }) : Promise.resolve();
  }));
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
}

export function computeNutrition(ingredients: Ingredient[], portions: number, foods: Map<number, Per100>, weights: Map<string, number>): NutResult {
  const sum: Per100 = {};
  const noWeight: Ingredient[] = [];
  const noFood: Ingredient[] = [];
  let counted = 0, assumedDensity = 0;
  const assumed: Ingredient[] = [];
  const standard: Ingredient[] = [];
  for (const i of ingredients) {
    const food = i.lv_food_id != null ? foods.get(i.lv_food_id) : undefined;
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
  }
  const p = Math.max(1, portions);
  const perPortion: Per100 = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, v / p]));
  return { perPortion, counted, noWeight, noFood, assumedDensity, assumed, standard };
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
