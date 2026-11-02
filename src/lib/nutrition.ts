import { supabase } from './supabase';
import { ML_PER_UNIT } from '../data/units';
import type { Ingredient } from './types';
import { matchFood } from './match';
import { parseIngredientLine } from '../../supabase/functions/_shared/parse';
import { isStockCube } from '../data/pieceWeights';
import { computeNutrition, isSpice, weightUnit, type Per100 } from './nutritionCalc';
import { forNutrition } from './english';
const VOLUME = (u: string) => ML_PER_UNIT[u] != null;
export * from './nutritionCalc';

export type { LvFood } from './match';
import type { LvFood } from './match';

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
export async function functionError(error: unknown, fn?: string): Promise<Error> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.status === 'number') {
    let body: Record<string, unknown> | null = null;
    let text = '';
    try { text = await ctx.clone().text(); body = JSON.parse(text); } catch { /* inte JSON */ }
    if (body?.error) return new Error(String(body.error));
    const name = fn ? `Funktionen ${fn}` : 'Funktionen';
    const server = String(body?.message ?? body?.msg ?? text ?? '').slice(0, 160);
    if (ctx.status === 404) return new Error(`${name} hittades inte i Supabase. Är den publicerad med exakt det namnet? (HTTP 404${server ? `: ${server}` : ''})`);
    if (ctx.status === 401) return new Error(`${name} nekade inloggningen. Logga ut och in igen. (HTTP 401${server ? `: ${server}` : ''})`);
    return new Error(`${name} svarade med ett fel (HTTP ${ctx.status}${server ? `: ${server}` : ''})`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

export function foodList(): Promise<LvFood[]> {
  if (!listPromise) {
    listPromise = (async () => {
      let list = await readList();
      if (list.length < 100) {
        const { data, error } = await supabase.functions.invoke('lv-foods', { body: { action: 'sync', force: true } });
        if (error) throw await functionError(error, 'lv-foods');
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
/** Matchar om alla ingredienser med nuvarande regler (utom livsmedel markerade som egna val). */
export async function rematchAll(ingredients: Ingredient[], update: (id: number, p: Partial<Ingredient>) => Promise<void>) {
  const foods = await foodList();
  // Engelska recept matchas med svenska namn (src/lib/english.ts).
  const sv = new Map(forNutrition(ingredients).map((v) => [v.id, v]));
  let changed = 0;
  for (const i of ingredients) {
    const v = sv.get(i.id) ?? i;
    if (i.lv_manual || isStockCube(v.name, v.unit) || isSpice(v)) continue;
    const m = matchFood(v.name, foods);
    const patch: Partial<Ingredient> = m
      ? { lv_food_id: m.food.id, lv_food_name: m.food.name, match_confidence: m.sure ? 'sure' : 'unsure' }
      : { lv_food_id: null, lv_food_name: null, match_confidence: 'unsure' };
    if (patch.lv_food_id === i.lv_food_id && patch.match_confidence === i.match_confidence) continue;
    await update(i.id, patch);
    changed++;
  }
  return changed;
}

export async function matchMissing(ingredients: Ingredient[], update: (id: number, p: Partial<Ingredient>) => Promise<void>) {
  // Engelska recept matchas med svenska namn (src/lib/english.ts); texten i receptet ändras inte.
  const sv = new Map(forNutrition(ingredients).map((v) => [v.id, v]));
  const view = (i: Ingredient) => { const v = sv.get(i.id); return v ? { ...i, name: v.name, unit: v.unit } : i; };
  const fixed = ingredients.map((i) => {
    if (i.unit || i.amount == null) return { i, patch: {} as Partial<Ingredient> };
    // Måttet hamnade i namnet ("0,25" + "cup cottage cheese"). Mängden tas också från tolkningen,
    // eftersom amerikanska mått räknas om (¼ cup → 0,59 dl), inte bara enheten.
    const range = i.amount_max != null && i.amount_max > i.amount ? `${i.amount}-${i.amount_max}` : `${i.amount}`;
    const p = parseIngredientLine(`${range} ${i.name}`);
    if (!p.unit) return { i, patch: {} };
    const patch: Partial<Ingredient> = { unit: p.unit, name: p.name, amount: p.amount, ...(p.amount_max != null ? { amount_max: p.amount_max } : {}) };
    return { i: { ...i, ...patch }, patch };
  });
  // Bara osäkra automatiska träffar prövas igen. Säkra träffar, och livsmedel som
  // användaren valt själv (alltid säkra), lämnas orörda.
  const stale = (i: Ingredient) => i.lv_food_id != null && !i.lv_manual && i.match_confidence === 'unsure';

  // Buljongtärningar räknas bara som salt och kryddor inte alls, så de behöver inget livsmedel.
  const todo = fixed.filter(({ i, patch }) => !isStockCube(view(i).name, view(i).unit) && !isSpice(view(i)) && (i.lv_food_id == null || stale(i) || Object.keys(patch).length));
  if (!todo.length) return;
  const foods = await foodList();
  await Promise.all(todo.map(({ i, patch }) => {
    if (i.lv_food_id != null && !stale(i)) return update(i.id, patch);
    const m = matchFood(view(i).name, foods);
    // Samma livsmedel som redan är kopplat (t.ex. ingen kokt potatis i databasen): skriv inte igen.
    if (m && m.food.id === i.lv_food_id) return Object.keys(patch).length ? update(i.id, patch) : Promise.resolve();
    if (m) return update(i.id, { ...patch, lv_food_id: m.food.id, lv_food_name: m.food.name, match_confidence: m.sure ? 'sure' : 'unsure' });
    // Redan markerad utan träff och inget att rätta: skriv inte igen.
    if (i.lv_food_id == null && i.match_confidence != null && !Object.keys(patch).length) return Promise.resolve();
    return update(i.id, { ...patch, lv_food_id: null, lv_food_name: null, match_confidence: 'unsure' });
  }));
}

/** Näringsvärden per livsmedel, plus eventuella fel från Livsmedelsverket per livsmedel. */
export async function fetchNutrients(ids: number[]): Promise<{ map: Map<number, Per100>; errors: string[] }> {
  const map = new Map<number, Per100>();
  if (!ids.length) return { map, errors: [] };
  const { data, error } = await supabase.functions.invoke('lv-foods', { body: { action: 'nutrients', ids } });
  if (error) throw await functionError(error, 'lv-foods');
  for (const f of (data?.foods ?? []) as { id: number; per_100g: Per100 | null }[]) if (f.per_100g) map.set(f.id, f.per_100g);
  return { map, errors: Object.values((data?.errors ?? {}) as Record<string, string>) };
}

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

/** Uppskattad energi per portion för granskningsvyn (innan receptet är sparat). */
export async function estimateKcal(lines: { amount: number | null; amount_max?: number | null; unit: string; name: string }[], portions: number): Promise<number | null> {
  if (!lines.length) return null;
  const foods = await foodList();
  const sv = forNutrition(lines.map((l, k) => ({ id: k, recipe_id: '', position: k, amount: l.amount, amount_max: l.amount_max ?? null, unit: l.unit, name: l.name,
    grams: null, lv_food_id: null, lv_food_name: null, match_confidence: null }) as Ingredient));
  const ings: Ingredient[] = sv.map((l, k) => {
    const m = matchFood(l.name, foods);
    return { id: k, recipe_id: '', position: k, amount: l.amount, amount_max: l.amount_max ?? null, unit: l.unit, name: l.name, grams: null,
      lv_food_id: m?.food.id ?? null, lv_food_name: m?.food.name ?? null, match_confidence: m ? (m.sure ? 'sure' : 'unsure') : null };
  });
  const ids = [...new Set(ings.map((i) => i.lv_food_id).filter((x): x is number => x != null))];
  const [f, w] = await Promise.all([fetchNutrients(ids), fetchUnitWeights(ids)]);
  const res = computeNutrition(ings, portions, f.map, w);
  return res.counted ? Math.round(res.perPortion.kcal ?? 0) : null;
}
