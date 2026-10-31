import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { today } from './dates';
import { TONE_ORDER } from './format';
import type { Household, Ingredient, NewRecipe, PlanEntry, Recipe, Step, Tag, Tone } from './types';

interface Data {
  recipes: Recipe[];
  tags: Tag[];
  plan: PlanEntry[];
  pantry: string[];
}

interface Store extends Data {
  session: Session | null;
  authReady: boolean;
  household: Household | null;
  households: Household[];
  selectHousehold: (id: string) => void;
  householdLoading: boolean;
  loaded: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createHousehold: (name?: string) => Promise<void>;
  joinHousehold: (code: string) => Promise<void>;
  rotateInvite: () => Promise<void>;
  renameHousehold: (name: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  signOut: () => Promise<void>;
  // recept
  saveRecipe: (r: NewRecipe) => Promise<string>;
  deleteRecipe: (id: string) => Promise<void>;
  cookedToday: (id: string) => Promise<void>;
  toggleChecked: (recipeId: string, ingredientId: number) => Promise<void>;
  resetChecked: (recipeId: string) => Promise<void>;
  saveNote: (recipeId: string, text: string) => Promise<void>;
  addIngredients: (recipeId: string, lines: { amount: number | null; unit: string; name: string }[]) => Promise<void>;
  editRecipe: (recipeId: string, edit: RecipeEdit) => Promise<void>;
  updateIngredient: (id: number, patch: Partial<Pick<Ingredient, 'lv_food_id' | 'lv_food_name' | 'match_confidence' | 'grams'>>) => Promise<void>;
  // taggar
  addTag: (name: string) => Promise<Tag>;
  cycleTagTone: (id: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  // vecka
  setPlan: (date: string, recipeId: string | null) => Promise<void>;
  // skafferi
  addPantry: (name: string) => Promise<void>;
  removePantry: (name: string) => Promise<void>;
}

export interface RecipeEdit {
  fields: Partial<Pick<Recipe, 'name' | 'portions' | 'effort' | 'book_title' | 'page'>>;
  ingredients: { amount: number | null; unit: string; name: string }[];
  steps: string[];
  tagIds: string[];
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore utanför StoreProvider');
  return s;
};

const HH_KEY = 'receptappen.household';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdLoading, setHouseholdLoading] = useState(true);
  const [data, setData] = useState<Data>({ recipes: [], tags: [], plan: [], pantry: [] });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hid = household?.id ?? null;

  // ── auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── hushåll ──
  const loadHousehold = useCallback(async (): Promise<{ h: Household | null; error: string | null }> => {
    if (!session) { setHousehold(null); setHouseholdLoading(false); return { h: null, error: null }; }
    setHouseholdLoading(true);
    const withCount = await supabase.from('households')
      .select('id,name,invite_code,created_at,recipes!recipes_household_id_fkey(count)').order('created_at');
    // Reserv om antal inte går att bädda in: hämta köken utan antal.
    const res = withCount.error ? await supabase.from('households').select('id,name,invite_code,created_at').order('created_at') : withCount;
    const { data, error: e } = res as { data: unknown[] | null; error: { message: string } | null };
    setError(e ? e.message : null);
    type Row = Household & { created_at: string; recipes: { count: number }[] };
    const rows: Household[] = ((data ?? []) as unknown as Row[]).map(({ recipes, created_at: _c, ...h }) => ({ ...h, recipeCount: Array.isArray(recipes) ? recipes[0]?.count ?? 0 : undefined }));
    setHouseholds(rows);
    // Senast valda köket på den här enheten; annars köket med flest recept (vid lika: det nyaste).
    const preferred = localStorage.getItem(HH_KEY);
    const fallback = [...rows].reverse().sort((a, b) => (b.recipeCount ?? 0) - (a.recipeCount ?? 0))[0] ?? null;
    const h = rows.find((x) => x.id === preferred) ?? fallback;
    if (h) localStorage.setItem(HH_KEY, h.id);
    setHousehold(h);
    setHouseholdLoading(false);
    return { h, error: e?.message ?? null };
  }, [session]);

  useEffect(() => { void loadHousehold(); }, [loadHousehold]);

  // ── data ──
  const reload = useCallback(async () => {
    if (!hid) return;
    const [rec, tags, plan, pantry] = await Promise.all([
      supabase.from('recipes')
        .select([
          '*',
          // Främmande nycklar anges uttryckligen: checked_items kopplar också ihop
          // recipes och recipe_ingredients, så annars blir inbäddningen tvetydig.
          'recipe_ingredients!recipe_ingredients_recipe_id_fkey(*)',
          'recipe_steps!recipe_steps_recipe_id_fkey(*)',
          'recipe_tags!recipe_tags_recipe_id_fkey(tag_id)',
          'notes!notes_recipe_id_fkey(text,updated_at,updated_by)',
          'checked_items!checked_items_recipe_id_fkey(ingredient_id)',
        ].join(','))
        .eq('household_id', hid).order('created_at', { ascending: false }),
      supabase.from('tags').select('*').eq('household_id', hid).order('created_at'),
      supabase.from('week_plan').select('date,recipe_id').eq('household_id', hid),
      supabase.from('pantry_items').select('name').eq('household_id', hid).order('created_at'),
    ]);
    const err = rec.error || tags.error || plan.error || pantry.error;
    if (err) { setError(err.message); return; }
    setError(null);
    type Row = Recipe & {
      recipe_ingredients: Ingredient[]; recipe_steps: Step[]; recipe_tags: { tag_id: string }[];
      notes: Recipe['note'] | Recipe['note'][]; checked_items: { ingredient_id: number }[];
    };
    const recipes = (rec.data as unknown as Row[]).map(({ recipe_ingredients, recipe_steps, recipe_tags, notes, checked_items, ...r }) => ({
      ...r,
      ingredients: [...recipe_ingredients].sort((a, b) => a.position - b.position).map((i) => ({ ...i, amount: i.amount == null ? null : Number(i.amount), grams: i.grams == null ? null : Number(i.grams) })),
      steps: [...recipe_steps].sort((a, b) => a.position - b.position),
      tagIds: recipe_tags.map((t) => t.tag_id),
      note: Array.isArray(notes) ? notes[0] ?? null : notes,
      checked: checked_items.map((c) => Number(c.ingredient_id)),
    }));
    setData({ recipes, tags: tags.data as Tag[], plan: plan.data as PlanEntry[], pantry: (pantry.data ?? []).map((p) => p.name) });
    setLoaded(true);
  }, [hid]);

  // ── realtime: hämta om allt vid ändring (små datamängder, två personer) ──
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!hid) return;
    setLoaded(false);
    reload();
    const schedule = () => { clearTimeout(timer.current); timer.current = window.setTimeout(reload, 250); };
    const tables = ['recipes', 'recipe_ingredients', 'recipe_steps', 'tags', 'recipe_tags', 'notes', 'checked_items', 'week_plan', 'pantry_items'];
    const ch = supabase.channel(`hh-${hid}`);
    for (const table of tables) {
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `household_id=eq.${hid}` }, schedule);
      ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `household_id=eq.${hid}` }, schedule);
      // DELETE-händelser går inte att filtrera i Supabase Realtime.
      ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, schedule);
    }
    ch.subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer.current); supabase.removeChannel(ch); document.removeEventListener('visibilitychange', onVisible); };
  }, [hid, reload]);

  const must = <T,>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };

  const patchRecipe = (id: string, fn: (r: Recipe) => Recipe) =>
    setData((d) => ({ ...d, recipes: d.recipes.map((r) => (r.id === id ? fn(r) : r)) }));

  const actions = useMemo(() => {
    const need = () => { if (!hid) throw new Error('Inget kök valt'); return hid; };
    return {
      createHousehold: async (name?: string) => {
        const h = must(await supabase.rpc('create_household', { p_name: name ?? 'Vårt kök' })) as Household;
        localStorage.setItem(HH_KEY, h.id);
        const res = await loadHousehold();
        if (!res.h) throw new Error(`Köket sparades men kunde inte läsas: ${res.error ?? 'inga rader'}`);
      },
      joinHousehold: async (code: string) => {
        const h = must(await supabase.rpc('join_household', { p_code: code })) as Household;
        localStorage.setItem(HH_KEY, h.id);
        const res = await loadHousehold();
        if (!res.h) throw new Error(`Köket sparades men kunde inte läsas: ${res.error ?? 'inga rader'}`);
      },
      renameHousehold: async (name: string) => {
        const id = need();
        const clean = name.trim().slice(0, 60) || 'Vårt kök';
        setHousehold((h) => (h ? { ...h, name: clean } : h));
        must(await supabase.from('households').update({ name: clean }).eq('id', id));
      },
      leaveHousehold: async () => {
        const id = need();
        const uid = session?.user.id;
        if (!uid) throw new Error('Inte inloggad');
        must(await supabase.from('household_members').delete().eq('household_id', id).eq('user_id', uid));
        localStorage.removeItem(HH_KEY);
        setData({ recipes: [], tags: [], plan: [], pantry: [] });
        await loadHousehold();
      },
      rotateInvite: async () => {
        const code = must(await supabase.rpc('rotate_invite_code', { p_household: need() })) as string;
        setHousehold((h) => (h ? { ...h, invite_code: code } : h));
      },
      signOut: async () => { await supabase.auth.signOut(); setData({ recipes: [], tags: [], plan: [], pantry: [] }); },

      saveRecipe: async (r: NewRecipe) => {
        const household_id = need();
        const { ingredients, steps, tagIds, ...rest } = r;
        const rec = must(await supabase.from('recipes').insert({ ...rest, household_id }).select('id').single()) as { id: string };
        if (ingredients.length) {
          must(await supabase.from('recipe_ingredients').insert(
            ingredients.map((i, position) => ({ ...i, position, household_id, recipe_id: rec.id }))));
        }
        if (steps.length) {
          must(await supabase.from('recipe_steps').insert(
            steps.map((text, position) => ({ text, position, household_id, recipe_id: rec.id }))));
        }
        if (tagIds.length) {
          must(await supabase.from('recipe_tags').insert(tagIds.map((tag_id) => ({ tag_id, household_id, recipe_id: rec.id }))));
        }
        await reload();
        return rec.id;
      },
      deleteRecipe: async (id: string) => {
        setData((d) => ({ ...d, recipes: d.recipes.filter((r) => r.id !== id), plan: d.plan.filter((p) => p.recipe_id !== id) }));
        must(await supabase.from('recipes').delete().eq('id', id));
      },
      cookedToday: async (id: string) => {
        const t = today();
        patchRecipe(id, (r) => ({ ...r, last_cooked_on: t, checked: [] }));
        must(await supabase.from('recipes').update({ last_cooked_on: t }).eq('id', id));
        must(await supabase.from('checked_items').delete().eq('recipe_id', id));
      },
      toggleChecked: async (recipeId: string, ingredientId: number) => {
        const household_id = need();
        let on = false;
        patchRecipe(recipeId, (r) => {
          on = !r.checked.includes(ingredientId);
          return { ...r, checked: on ? [...r.checked, ingredientId] : r.checked.filter((x) => x !== ingredientId) };
        });
        if (on) must(await supabase.from('checked_items').upsert({ household_id, recipe_id: recipeId, ingredient_id: ingredientId }));
        else must(await supabase.from('checked_items').delete().eq('recipe_id', recipeId).eq('ingredient_id', ingredientId));
      },
      resetChecked: async (recipeId: string) => {
        patchRecipe(recipeId, (r) => ({ ...r, checked: [] }));
        must(await supabase.from('checked_items').delete().eq('recipe_id', recipeId));
      },
      saveNote: async (recipeId: string, text: string) => {
        const household_id = need();
        const updated_at = new Date().toISOString();
        const uid = session?.user.id ?? null;
        patchRecipe(recipeId, (r) => ({ ...r, note: { text, updated_at, updated_by: uid } }));
        must(await supabase.from('notes').upsert({ recipe_id: recipeId, household_id, text, updated_at, updated_by: uid }));
      },
      addIngredients: async (recipeId: string, lines: { amount: number | null; unit: string; name: string }[]) => {
        const household_id = need();
        const r = data.recipes.find((x) => x.id === recipeId);
        const start = r ? r.ingredients.length : 0;
        must(await supabase.from('recipe_ingredients').insert(lines.map((l, k) => ({ ...l, position: start + k, household_id, recipe_id: recipeId }))));
        await reload();
      },
      editRecipe: async (recipeId: string, edit: RecipeEdit) => {
        const household_id = need();
        const r = data.recipes.find((x) => x.id === recipeId);
        if (!r) throw new Error('Receptet finns inte');
        must(await supabase.from('recipes').update(edit.fields).eq('id', recipeId));

        // Ingredienser: oförändrade rader behåller sitt livsmedel, sin vikt och avbockning.
        const key = (i: { amount: number | null; unit: string; name: string }) => `${i.amount ?? ''}|${i.unit}|${i.name.trim().toLowerCase()}`;
        const remaining = [...r.ingredients];
        const keepIds: number[] = [];
        const plan = edit.ingredients.map((l, position) => {
          const k = remaining.findIndex((x) => key(x) === key(l));
          if (k >= 0) { const [old] = remaining.splice(k, 1); keepIds.push(old.id); return { id: old.id, position }; }
          return { new: { ...l, position, household_id, recipe_id: recipeId } };
        });
        if (remaining.length) must(await supabase.from('recipe_ingredients').delete().in('id', remaining.map((x) => x.id)));
        for (const p of plan) if ('id' in p) must(await supabase.from('recipe_ingredients').update({ position: p.position }).eq('id', p.id!));
        const fresh = plan.filter((p) => 'new' in p).map((p) => p.new!);
        if (fresh.length) must(await supabase.from('recipe_ingredients').insert(fresh));

        // Steg: oförändrade steg behåller sin koppling till ingredienser.
        const oldSteps = [...r.steps];
        const stepRows = edit.steps.map((text, position) => {
          const k = oldSteps.findIndex((x) => x.text === text);
          const ids = k >= 0 ? oldSteps.splice(k, 1)[0].ingredient_ids : null;
          return { text, position, household_id, recipe_id: recipeId, ingredient_ids: ids?.filter((id) => keepIds.includes(Number(id))) ?? null };
        });
        must(await supabase.from('recipe_steps').delete().eq('recipe_id', recipeId));
        if (stepRows.length) must(await supabase.from('recipe_steps').insert(stepRows));

        // Taggar
        const add = edit.tagIds.filter((t) => !r.tagIds.includes(t));
        const del = r.tagIds.filter((t) => !edit.tagIds.includes(t));
        if (del.length) must(await supabase.from('recipe_tags').delete().eq('recipe_id', recipeId).in('tag_id', del));
        if (add.length) must(await supabase.from('recipe_tags').insert(add.map((tag_id) => ({ tag_id, household_id, recipe_id: recipeId }))));
        await reload();
      },
      updateIngredient: async (id: number, patch: Partial<Pick<Ingredient, 'lv_food_id' | 'lv_food_name' | 'match_confidence' | 'grams'>>) => {
        setData((d) => ({ ...d, recipes: d.recipes.map((r) => ({ ...r, ingredients: r.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)) })) }));
        must(await supabase.from('recipe_ingredients').update(patch).eq('id', id));
      },

      addTag: async (name: string) => {
        const household_id = need();
        const tone = TONE_ORDER[data.tags.length % 4];
        const tag = must(await supabase.from('tags').insert({ household_id, name, tone }).select('*').single()) as Tag;
        setData((d) => ({ ...d, tags: [...d.tags, tag] }));
        return tag;
      },
      cycleTagTone: async (id: string) => {
        const t = data.tags.find((x) => x.id === id);
        if (!t) return;
        const tone: Tone = TONE_ORDER[(TONE_ORDER.indexOf(t.tone) + 1) % 4];
        setData((d) => ({ ...d, tags: d.tags.map((x) => (x.id === id ? { ...x, tone } : x)) }));
        must(await supabase.from('tags').update({ tone }).eq('id', id));
      },
      deleteTag: async (id: string) => {
        setData((d) => ({ ...d, tags: d.tags.filter((x) => x.id !== id), recipes: d.recipes.map((r) => ({ ...r, tagIds: r.tagIds.filter((t) => t !== id) })) }));
        must(await supabase.from('tags').delete().eq('id', id));
      },

      setPlan: async (date: string, recipeId: string | null) => {
        const household_id = need();
        setData((d) => ({ ...d, plan: [...d.plan.filter((p) => p.date !== date), ...(recipeId ? [{ date, recipe_id: recipeId }] : [])] }));
        if (recipeId) must(await supabase.from('week_plan').upsert({ household_id, date, recipe_id: recipeId }));
        else must(await supabase.from('week_plan').delete().eq('household_id', household_id).eq('date', date));
      },

      addPantry: async (name: string) => {
        const household_id = need();
        setData((d) => ({ ...d, pantry: [...d.pantry, name] }));
        must(await supabase.from('pantry_items').upsert({ household_id, name }));
      },
      removePantry: async (name: string) => {
        const household_id = need();
        setData((d) => ({ ...d, pantry: d.pantry.filter((p) => p !== name) }));
        must(await supabase.from('pantry_items').delete().eq('household_id', household_id).eq('name', name));
      },
    };
  }, [hid, data.tags, data.recipes, loadHousehold, reload, session]);

  const selectHousehold = useCallback((id: string) => {
    const h = households.find((x) => x.id === id);
    if (!h) return;
    localStorage.setItem(HH_KEY, id);
    setHousehold(h);
  }, [households]);

  const value: Store = { session, authReady, household, households, selectHousehold, householdLoading, loaded, error, reload, ...data, ...actions };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
