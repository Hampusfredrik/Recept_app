import { daysSince, iso, weekDates, fromIso, today, WEEKDAYS } from './dates';
import type { PlanEntry, Recipe, Tag } from './types';

/** Aldrig lagade räknas som längst sedan. */
export const daysOf = (r: Recipe) => daysSince(r.last_cooked_on) ?? 99999;
export const byLongestAgo = (a: Recipe, b: Recipe) => daysOf(b) - daysOf(a);

export function heroRecipe(recipes: Recipe[], plan: PlanEntry[]): Recipe | null {
  const planned = new Set(plan.map((p) => p.recipe_id));
  const longest = [...recipes].sort(byLongestAgo);
  return longest.find((r) => !planned.has(r.id)) ?? longest[0] ?? null;
}

/** Första tomma dag från idag och framåt: först den här veckan, sedan nästa. */
export function firstEmptyDay(plan: PlanEntry[], ref = new Date()): { date: string; nextWeek: boolean } | null {
  const t = today();
  const taken = new Set(plan.map((p) => p.date));
  const free = (days: Date[]) => days.map(iso).find((x) => x >= t && !taken.has(x));
  const now = free(weekDates(ref));
  if (now) return { date: now, nextWeek: false };
  const next = new Date(ref); next.setDate(next.getDate() + 7);
  const later = free(weekDates(next));
  return later ? { date: later, nextWeek: true } : null;
}

export const dayName = (dateIso: string) => WEEKDAYS[(fromIso(dateIso).getDay() + 6) % 7];

// ── Vad kan jag laga? ──
export function makeHas(pantry: string[]) {
  const pn = pantry.map((p) => p.toLowerCase().trim()).filter(Boolean);
  return (name: string) => {
    const n = name.toLowerCase();
    return pn.some((p) => n.includes(p) || p.includes(n) || n.split(/\s+/).some((w) => w.length >= 4 && p.includes(w.slice(0, 5))));
  };
}

export function pantryResults(recipes: Recipe[], pantry: string[]) {
  const has = makeHas(pantry);
  return recipes.filter((r) => r.ingredients.length)
    .map((r) => {
      const missing = r.ingredients.filter((i) => !has(i.name)).map((i) => i.name);
      return { recipe: r, missing, total: r.ingredients.length };
    })
    .sort((a, b) => a.missing.length - b.missing.length || b.total - a.total);
}

export function pantrySuggestions(recipes: Recipe[], pantry: string[], max = 8) {
  const has = makeHas(pantry);
  const freq = new Map<string, number>();
  for (const r of recipes) {
    for (const k of new Set(r.ingredients.map((i) => i.name.toLowerCase()))) freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  return [...freq.keys()].sort((a, b) => freq.get(b)! - freq.get(a)!).filter((k) => !has(k)).slice(0, max);
}

// ── Receptlistan ──
export interface LibFilter { q: string; chip: string | null; eff: number[]; src: 'alla' | 'web' | 'book'; tagSel: string[]; sort: 'new' | 'low' | 'high' }
/** Filterchipet "Favoriter" i receptlistan (inte en tagg). */
export const FAV_CHIP = '__fav';
export const emptyFilter: LibFilter = { q: '', chip: null, eff: [], src: 'alla', tagSel: [], sort: 'new' };

export function filterRecipes(recipes: Recipe[], tags: Tag[], f: LibFilter) {
  const ql = f.q.trim().toLowerCase();
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name ?? '';
  const list = recipes.filter((r) => {
    if (f.chip === FAV_CHIP) { if (!r.is_favorite) return false; }
    else if (f.chip && !r.tagIds.includes(f.chip)) return false;
    if (f.eff.length && !f.eff.includes(r.effort)) return false;
    if (f.src !== 'alla' && r.source_type !== f.src) return false;
    if (f.tagSel.length && !f.tagSel.every((t) => r.tagIds.includes(t))) return false;
    if (ql) {
      const hay = [r.name, ...r.tagIds.map(tagName), r.book_title ?? '', r.url ?? ''].join(' ').toLowerCase();
      if (!hay.includes(ql)) return false;
    }
    return true;
  });
  return list.sort((a, b) =>
    f.sort === 'low' ? a.effort - b.effort : f.sort === 'high' ? b.effort - a.effort : b.created_at.localeCompare(a.created_at));
}

export const filterCount = (f: LibFilter) => f.eff.length + f.tagSel.length + (f.src !== 'alla' ? 1 : 0) + (f.sort !== 'new' ? 1 : 0);

export const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
