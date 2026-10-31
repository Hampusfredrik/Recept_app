// Inköpslista för en vecka: alla ingredienser i veckans planerade recept, sammanslagna.
// Ren logik utan databasanrop, så att den kan testas direkt.
import { G_PER_UNIT, ML_PER_UNIT } from '../data/units.ts';
import { stem, words } from './match.ts';
import { isSeasoning, isSpice, isWater } from './nutritionCalc.ts';
import type { Ingredient, Recipe } from './types.ts';

export interface ShoppingItem {
  key: string;
  name: string;
  /** Sammanlagd mängd, t.ex. "3 st + 400 g". Tom om inget recept anger mängd. */
  amount: string;
  /** Minst ett recept anger ingen mängd ("efter smak", "till servering"). */
  someUnmeasured: boolean;
  recipes: string[];
  /** Kryddor, salt och peppar: brukar finnas hemma. */
  staple: boolean;
}

// Ord som beskriver storlek eller hantering, inte vad som ska köpas.
const SKIP = new Set(['stor', 'stora', 'liten', 'litet', 'små', 'medelstor', 'medelstora', 'hackad', 'hackade', 'finhackad', 'finhackade',
  'skivad', 'skivade', 'tärnad', 'tärnade', 'riven', 'rivet', 'rivna', 'finriven', 'pressad', 'pressade', 'strimlad', 'strimlade',
  'färsk', 'färska', 'färskt', 'ca', 'cirka', 'ev', 'eventuellt', 'gärna', 'och', 'till', 'servering', 'efter', 'smak', 'av']);

/** Namnet som det skrivs på listan: utan parenteser och utan det som står efter ett kommatecken. */
export function shoppingName(name: string): string {
  const base = name.replace(/\([^)]*\)/g, ' ').split(',')[0].replace(/\s+/g, ' ').trim();
  const kept = base.split(' ').filter((w) => !SKIP.has(w.toLowerCase()));
  return (kept.length ? kept.join(' ') : base).toLowerCase();
}

const nameKey = (name: string) => words(shoppingName(name)).filter((w) => !SKIP.has(w)).map(stem).join(' ');

/** Samma vara: samma säkra livsmedel i databasen, annars samma namn (singular och plural räknas lika). */
export function itemKey(i: Ingredient): string {
  if (i.lv_food_id != null && (i.lv_manual || i.match_confidence === 'sure')) return `lv:${i.lv_food_id}`;
  return `n:${nameKey(i.name)}`;
}

type Sums = Map<string, number>; // 'ml' | 'g' | annan enhet → summa

function add(sums: Sums, amount: number, unit: string) {
  const u = unit.toLowerCase().trim();
  if (ML_PER_UNIT[u] != null) sums.set('ml', (sums.get('ml') ?? 0) + amount * ML_PER_UNIT[u]);
  else if (G_PER_UNIT[u] != null) sums.set('g', (sums.get('g') ?? 0) + amount * G_PER_UNIT[u]);
  else sums.set(u || 'st', (sums.get(u || 'st') ?? 0) + amount);
}

const num = (n: number) => {
  const v = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return String(v).replace('.', ',');
};

function volume(ml: number): string {
  if (ml >= 1000) return `${num(ml / 1000)} l`;
  if (ml >= 100) return `${num(ml / 100)} dl`;
  if (ml >= 15) return `${num(ml / 15)} msk`;
  if (ml >= 5) return `${num(ml / 5)} tsk`;
  return `${num(ml)} krm`;
}

export function formatSums(sums: Sums): string {
  const parts: string[] = [];
  for (const [u, v] of sums) {
    if (u === 'ml') parts.push(volume(v));
    else if (u === 'g') parts.push(v >= 1000 ? `${num(v / 1000)} kg` : `${num(v)} g`);
    else parts.push(`${num(v)} ${u}`);
  }
  return parts.join(' + ');
}

/** Recepten i den ordning de är planerade. Ett recept som planeras två gånger räknas två gånger. */
export function shoppingList(recipes: Recipe[]): ShoppingItem[] {
  const groups = new Map<string, { names: string[]; sums: Sums; unmeasured: boolean; recipes: string[]; staple: boolean; order: number }>();
  let order = 0;
  for (const r of recipes) {
    for (let i of r.ingredients) {
      if (isWater(i) || !i.name.trim()) continue;
      // "1 knippe dill" utan enhet: knippet är enheten, dillen är varan.
      const bunch = !i.unit && /^(knippe|knippa|knippen|kruka|krukor)\s+/i.exec(i.name);
      if (bunch) i = { ...i, unit: bunch[1].toLowerCase().startsWith('kruk') ? 'kruka' : 'knippe', name: i.name.slice(bunch[0].length) };
      const key = itemKey(i);
      let g = groups.get(key);
      if (!g) { g = { names: [], sums: new Map(), unmeasured: false, recipes: [], staple: true, order: order++ }; groups.set(key, g); }
      g.names.push(shoppingName(i.name));
      if (i.amount != null && i.amount > 0) add(g.sums, i.amount, i.unit);
      else g.unmeasured = true;
      if (!g.recipes.includes(r.name)) g.recipes.push(r.name);
      // En vara räknas som krydda bara om alla rader för den är kryddor.
      // Färska örter i knippe eller kruka köps, även om de inte räknas i näringsvärdet.
      const herb = /knipp|kruk/i.test(`${i.unit} ${i.name}`);
      g.staple = g.staple && !herb && (isSpice(i) || isSeasoning(i));
    }
  }
  return [...groups.entries()].sort((a, b) => a[1].order - b[1].order).map(([key, g]) => ({
    key,
    // Det kortaste namnet är oftast det allmännaste ("lök" före "gul lök").
    name: [...g.names].sort((a, b) => a.length - b.length)[0],
    amount: formatSums(g.sums),
    someUnmeasured: g.unmeasured && g.sums.size > 0,
    recipes: g.recipes,
    staple: g.staple,
  }));
}
