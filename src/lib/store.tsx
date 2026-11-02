import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { today } from './dates';
import { TONE_ORDER } from './format';
import { shrinkImage } from './images';
import type { Household, Ingredient, NewRecipe, PlanEntry, Recipe, Step, Tag, Tone, Member, ShoppingExtra, Feedback, StepInput } from './types';

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
  /** Personerna i köket. */
  members: Member[];
  /** Namnet på en person i köket, eller null. */
  memberName: (userId: string | null | undefined) => string | null;
  setMyName: (name: string) => Promise<void>;
  // egna varor i inköpslistan
  extras: ShoppingExtra[];
  addExtra: (name: string) => Promise<void>;
  toggleExtra: (id: number) => Promise<void>;
  removeExtra: (id: number) => Promise<void>;
  clearCheckedExtras: () => Promise<void>;
  // förslag på ändringar i appen
  feedback: Feedback[];
  addFeedback: (text: string) => Promise<void>;
  setFeedbackDone: (id: number, done: boolean) => Promise<void>;
  removeFeedback: (id: number) => Promise<void>;
  // recept
  saveRecipe: (r: NewRecipe) => Promise<string>;
  /** Meddelande efter saveRecipe om något inte kunde sparas fullt ut (t.ex. delar utan migrering), annars null. */
  takeSaveWarning: () => string | null;
  deleteRecipe: (id: string) => Promise<void>;
  cookedToday: (id: string) => Promise<void>;
  toggleChecked: (recipeId: string, ingredientId: number) => Promise<void>;
  resetChecked: (recipeId: string) => Promise<void>;
  saveNote: (recipeId: string, text: string) => Promise<void>;
  addIngredients: (recipeId: string, lines: { amount: number | null; amount_max?: number | null; unit: string; name: string }[]) => Promise<void>;
  editRecipe: (recipeId: string, edit: RecipeEdit) => Promise<void>;
  /** Lägger till ett delrecept (t.ex. Frosting) sist i receptet. */
  addSection: (recipeId: string, name: string, ingredients: { amount: number | null; amount_max?: number | null; unit: string; name: string }[], steps: string[]) => Promise<void>;
  setRecipeImage: (recipeId: string, file: File | null) => Promise<void>;
  setRecipeImageUrl: (recipeId: string, url: string) => Promise<void>;
  updateIngredient: (id: number, patch: Partial<Pick<Ingredient, 'lv_food_id' | 'lv_food_name' | 'match_confidence' | 'grams' | 'lv_manual' | 'amount' | 'amount_max' | 'unit' | 'name'>>) => Promise<void>;
  // taggar
  addTag: (name: string) => Promise<Tag>;
  cycleTagTone: (id: string) => Promise<void>;
  setTagNoSuggest: (id: string, on: boolean) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  // vecka
  toggleFavorite: (recipeId: string) => Promise<void>;
  setPlan: (date: string, recipeId: string | null) => Promise<void>;
  // skafferi
  addPantry: (name: string) => Promise<void>;
  removePantry: (name: string) => Promise<void>;
}

export interface RecipeEdit {
  fields: Partial<Pick<Recipe, 'name' | 'portions' | 'effort' | 'book_title' | 'page' | 'created_by'>>;
  ingredients: { amount: number | null; amount_max?: number | null; unit: string; name: string; section?: string | null }[];
  steps: StepInput[];
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
  const [members, setMembers] = useState<Member[]>([]);
  const [extras, setExtras] = useState<ShoppingExtra[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const hid = household?.id ?? null;

  // ── auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── hushåll ──
  // Beror bara på vem som är inloggad, inte på sessionsobjektet: Supabase förnyar sessionen
  // i bakgrunden (t.ex. när man kommer tillbaka till fliken), och det får inte ladda om köket
  // och visa laddningsskärmen, för då försvinner det man höll på med.
  const sessionUid = session?.user.id ?? null;
  const hhOnce = useRef(false);
  const loadHousehold = useCallback(async (): Promise<{ h: Household | null; error: string | null }> => {
    if (!sessionUid) { hhOnce.current = false; setHousehold(null); setHouseholdLoading(false); return { h: null, error: null }; }
    // Laddningsskärmen visas bara första gången; senare hämtningar sker i bakgrunden.
    if (!hhOnce.current) setHouseholdLoading(true);
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
    // Samma kök som förut: behåll objektet, så att inget laddas om i onödan.
    setHousehold((cur) => (cur && h && cur.id === h.id && cur.name === h.name && cur.invite_code === h.invite_code ? cur : h));
    hhOnce.current = true;
    setHouseholdLoading(false);
    return { h, error: e?.message ?? null };
  }, [sessionUid]);

  useEffect(() => { void loadHousehold(); }, [loadHousehold]);

  // ── data ──
  const myId = session?.user.id;
  const myEmail = session?.user.email;
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
      ingredients: [...recipe_ingredients].sort((a, b) => a.position - b.position).map((i) => ({ ...i, amount: i.amount == null ? null : Number(i.amount), amount_max: i.amount_max == null ? null : Number(i.amount_max), grams: i.grams == null ? null : Number(i.grams) })),
      steps: [...recipe_steps].sort((a, b) => a.position - b.position),
      tagIds: recipe_tags.map((t) => t.tag_id),
      note: Array.isArray(notes) ? notes[0] ?? null : notes,
      checked: checked_items.map((c) => Number(c.ingredient_id)),
    }));
    setData({ recipes, tags: tags.data as Tag[], plan: plan.data as PlanEntry[], pantry: (pantry.data ?? []).map((p) => p.name) });
    // Personerna i köket. Kolumnen display_name kan saknas om migreringen inte körts.
    let mem = await supabase.from('household_members').select('user_id,display_name').eq('household_id', hid);
    if (mem.error) mem = await supabase.from('household_members').select('user_id').eq('household_id', hid) as typeof mem;
    const list = ((mem.data ?? []) as Member[]).map((x) => ({ user_id: x.user_id, display_name: x.display_name ?? null }));
    // Eget namn saknas: förifyll med förnamnet ur e-postadressen (kan ändras under Ert kök).
    const uid = myId;
    const me = list.find((x) => x.user_id === uid);
    if (me && !me.display_name && !mem.error && 'display_name' in ((mem.data ?? [])[0] ?? {})) {
      const guess = (myEmail ?? '').split('@')[0].split(/[._+\-0-9]/)[0];
      if (guess) {
        me.display_name = guess.charAt(0).toUpperCase() + guess.slice(1).toLowerCase();
        await supabase.from('household_members').update({ display_name: me.display_name }).eq('household_id', hid).eq('user_id', uid!);
      }
    }
    setMembers(list);

    // Tabellerna kan saknas om migreringen inte körts: då är listorna tomma.
    const [ex, fb] = await Promise.all([
      supabase.from('shopping_extras').select('id,name,checked,created_by,created_at').eq('household_id', hid).order('created_at'),
      supabase.from('feedback').select('id,text,created_by,created_at,done_at').eq('household_id', hid).order('created_at', { ascending: false }),
    ]);
    setExtras(ex.error ? [] : (ex.data as ShoppingExtra[]));
    setFeedback(fb.error ? [] : (fb.data as Feedback[]));
    setLoaded(true);
  }, [hid, myId, myEmail]);

  // ── realtime: hämta om allt vid ändring (små datamängder, två personer) ──
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!hid) return;
    setLoaded(false);
    reload();
    const schedule = () => { clearTimeout(timer.current); timer.current = window.setTimeout(reload, 250); };
    const tables = ['recipes', 'recipe_ingredients', 'recipe_steps', 'tags', 'recipe_tags', 'notes', 'checked_items', 'week_plan', 'pantry_items', 'household_members', 'shopping_extras', 'feedback'];
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

  // Kolumnen amount_max (intervall som "1–2 msk") kan saknas om migreringen inte körts:
  // då sparas det lägre värdet som förut.
  // Kolumnen section (delar som "Frosting") kan också saknas: då sparas raderna utan del,
  // och sectionsMissing sätts så att den som redigerar får veta det.
  const sectionsMissing = useRef(false);
  const saveWarning = useRef<string | null>(null);
  const insertRows = async (table: 'recipe_ingredients' | 'recipe_steps', rows: Record<string, unknown>[]) => {
    let res = await supabase.from(table).insert(rows);
    for (const col of ['amount_max', 'section']) {
      if (res.error && new RegExp(col).test(res.error.message)) {
        if (col === 'section') sectionsMissing.current = true;
        rows = rows.map(({ [col]: _x, ...r }) => r);
        res = await supabase.from(table).insert(rows);
      }
    }
    return res;
  };
  const insertIngredients = (rows: Record<string, unknown>[]) => insertRows('recipe_ingredients', rows);
  const normStep = (s: StepInput) => (typeof s === 'string' ? { text: s, section: null } : s);

  // Som must, men med en tydlig hänvisning om tabellen inte finns än.
  const migrated = <T,>(r: { data: T; error: { message: string; code?: string } | null }, table: string): T => {
    if (r.error && (r.error.code === '42P01' || r.error.code === 'PGRST205' || (r.error.message.includes(table) && /does not exist|could not find/i.test(r.error.message)))) {
      throw new Error('Det här kräver migreringen 20261106120000_extras_and_feedback.sql i Supabase.');
    }
    return must(r);
  };

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
      setMyName: async (name: string) => {
        const id = need();
        const uid = session?.user.id;
        if (!uid) throw new Error('Inte inloggad');
        const clean = name.trim().slice(0, 40) || null;
        setMembers((m) => m.map((x) => (x.user_id === uid ? { ...x, display_name: clean } : x)));
        const res = await supabase.from('household_members').update({ display_name: clean }).eq('household_id', id).eq('user_id', uid);
        if (res.error) throw new Error(/display_name/.test(res.error.message) ? 'Namn kräver migreringen 20261105120000_recipe_author.sql i Supabase.' : res.error.message);
      },
      addExtra: async (name: string) => {
        const household_id = need();
        const clean = name.trim().slice(0, 120);
        if (!clean) return;
        const row = migrated(await supabase.from('shopping_extras').insert({ household_id, name: clean }).select('id,name,checked,created_by,created_at').single(), 'shopping_extras') as ShoppingExtra;
        setExtras((x) => [...x.filter((e) => e.id !== row.id), row]);
      },
      toggleExtra: async (id: number) => {
        const on = !extras.find((e) => e.id === id)?.checked;
        setExtras((x) => x.map((e) => (e.id === id ? { ...e, checked: on } : e)));
        migrated(await supabase.from('shopping_extras').update({ checked: on }).eq('id', id), 'shopping_extras');
      },
      removeExtra: async (id: number) => {
        setExtras((x) => x.filter((e) => e.id !== id));
        migrated(await supabase.from('shopping_extras').delete().eq('id', id), 'shopping_extras');
      },
      clearCheckedExtras: async () => {
        const household_id = need();
        setExtras((x) => x.filter((e) => !e.checked));
        migrated(await supabase.from('shopping_extras').delete().eq('household_id', household_id).eq('checked', true), 'shopping_extras');
      },
      addFeedback: async (text: string) => {
        const household_id = need();
        const clean = text.trim().slice(0, 2000);
        if (!clean) return;
        const row = migrated(await supabase.from('feedback').insert({ household_id, text: clean }).select('id,text,created_by,created_at,done_at').single(), 'feedback') as Feedback;
        setFeedback((x) => [row, ...x.filter((f) => f.id !== row.id)]);
      },
      setFeedbackDone: async (id: number, done: boolean) => {
        const done_at = done ? new Date().toISOString() : null;
        setFeedback((x) => x.map((f) => (f.id === id ? { ...f, done_at } : f)));
        migrated(await supabase.from('feedback').update({ done_at }).eq('id', id), 'feedback');
      },
      removeFeedback: async (id: number) => {
        setFeedback((x) => x.filter((f) => f.id !== id));
        migrated(await supabase.from('feedback').delete().eq('id', id), 'feedback');
      },
      signOut: async () => { await supabase.auth.signOut(); setData({ recipes: [], tags: [], plan: [], pantry: [] }); },

      saveRecipe: async (r: NewRecipe) => {
        const household_id = need();
        const { ingredients, steps, tagIds, ...rest } = r;
        sectionsMissing.current = false;
        const rec = must(await supabase.from('recipes').insert({ ...rest, household_id }).select('id').single()) as { id: string };
        if (ingredients.length) {
          must(await insertIngredients(ingredients.map((i, position) => ({ ...i, position, household_id, recipe_id: rec.id }))));
        }
        if (steps.length) {
          must(await insertRows('recipe_steps',
            steps.map(normStep).map(({ text, section }, position) => ({ text, position, household_id, recipe_id: rec.id, ...(section ? { section } : {}) }))));
        }
        if (tagIds.length) {
          must(await supabase.from('recipe_tags').insert(tagIds.map((tag_id) => ({ tag_id, household_id, recipe_id: rec.id }))));
        }
        await reload();
        const usedSections = ingredients.some((i) => i.section?.trim()) || steps.some((x) => typeof x !== 'string' && x.section?.trim());
        if (sectionsMissing.current && usedSections) {
          saveWarning.current = 'Receptet är sparat, men delarna (t.ex. Sås) hamnade i huvudreceptet: kör migreringen 20261107120000_recipe_sections.sql i Supabase.';
        }
        sectionsMissing.current = false;
        return rec.id;
      },
      takeSaveWarning: () => { const w = saveWarning.current; saveWarning.current = null; return w; },
      deleteRecipe: async (id: string) => {
        setData((d) => ({ ...d, recipes: d.recipes.filter((r) => r.id !== id), plan: d.plan.filter((p) => p.recipe_id !== id) }));
        must(await supabase.from('recipes').delete().eq('id', id));
      },
      cookedToday: async (id: string) => {
        const t = today();
        const household_id = need();
        patchRecipe(id, (r) => ({ ...r, last_cooked_on: t, checked: [] }));
        // Det som lagades läggs in på dagens datum i veckan (ersätter det som var planerat idag).
        setData((d) => ({ ...d, plan: [...d.plan.filter((p) => p.date !== t), { date: t, recipe_id: id }] }));
        must(await supabase.from('recipes').update({ last_cooked_on: t }).eq('id', id));
        must(await supabase.from('checked_items').delete().eq('recipe_id', id));
        must(await supabase.from('week_plan').upsert({ household_id, date: t, recipe_id: id }));
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
      addIngredients: async (recipeId: string, lines: { amount: number | null; amount_max?: number | null; unit: string; name: string }[]) => {
        const household_id = need();
        const r = data.recipes.find((x) => x.id === recipeId);
        const start = r ? r.ingredients.length : 0;
        must(await insertIngredients(lines.map((l, k) => ({ ...l, position: start + k, household_id, recipe_id: recipeId }))));
        await reload();
      },
      setRecipeImage: async (recipeId: string, file: File | null) => {
        const household_id = need();
        const r = data.recipes.find((x) => x.id === recipeId);
        // Gammal uppladdad bild tas bort (inte bilder från webbsidor).
        const marker = '/storage/v1/object/public/recipe-images/';
        const oldPath = r?.image_url?.includes(marker) ? r.image_url.split(marker)[1].split('?')[0] : null;
        let image_url: string | null = null;
        if (file) {
          const blob = await shrinkImage(file);
          const path = `${household_id}/${recipeId}-${Date.now()}.jpg`;
          const up = await supabase.storage.from('recipe-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
          if (up.error) throw new Error(up.error.message);
          image_url = supabase.storage.from('recipe-images').getPublicUrl(path).data.publicUrl;
        }
        patchRecipe(recipeId, (x) => ({ ...x, image_url }));
        must(await supabase.from('recipes').update({ image_url }).eq('id', recipeId));
        if (oldPath) await supabase.storage.from('recipe-images').remove([oldPath]);
      },
      setRecipeImageUrl: async (recipeId: string, image_url: string) => {
        const r = data.recipes.find((x) => x.id === recipeId);
        const marker = '/storage/v1/object/public/recipe-images/';
        const oldPath = r?.image_url?.includes(marker) ? r.image_url.split(marker)[1].split('?')[0] : null;
        patchRecipe(recipeId, (x) => ({ ...x, image_url }));
        must(await supabase.from('recipes').update({ image_url }).eq('id', recipeId));
        if (oldPath) await supabase.storage.from('recipe-images').remove([oldPath]);
      },
      addSection: async (recipeId: string, name: string, ingredients: { amount: number | null; amount_max?: number | null; unit: string; name: string }[], steps: string[]) => {
        const household_id = need();
        const r = data.recipes.find((x) => x.id === recipeId);
        if (!r) throw new Error('Receptet finns inte');
        const section = name.trim().slice(0, 80);
        if (!section) throw new Error('Ge delreceptet ett namn, t.ex. Frosting.');
        sectionsMissing.current = false;
        const i0 = r.ingredients.reduce((m, x) => Math.max(m, x.position + 1), 0);
        const s0 = r.steps.reduce((m, x) => Math.max(m, x.position + 1), 0);
        if (ingredients.length) must(await insertIngredients(ingredients.map((l, k) => ({ ...l, section, position: i0 + k, household_id, recipe_id: recipeId }))));
        if (steps.length) must(await insertRows('recipe_steps', steps.map((text, k) => ({ text, section, position: s0 + k, household_id, recipe_id: recipeId }))));
        await reload();
        if (sectionsMissing.current) {
          sectionsMissing.current = false;
          throw new Error('Delreceptet sparades i huvudreceptet: delar kräver migreringen 20261107120000_recipe_sections.sql i Supabase.');
        }
      },
      editRecipe: async (recipeId: string, edit: RecipeEdit) => {
        const household_id = need();
        sectionsMissing.current = false;
        const r = data.recipes.find((x) => x.id === recipeId);
        if (!r) throw new Error('Receptet finns inte');
        must(await supabase.from('recipes').update(edit.fields).eq('id', recipeId));

        // Ingredienser: oförändrade rader behåller sitt livsmedel, sin vikt och avbockning.
        const key = (i: { amount: number | null; amount_max?: number | null; unit: string; name: string }) => `${i.amount ?? ''}|${i.amount_max ?? ''}|${i.unit}|${i.name.trim().toLowerCase()}`;
        const remaining = [...r.ingredients];
        const keepIds: number[] = [];
        const sectionOf = (x: { section?: string | null }) => x.section?.trim() || null;
        const plan = edit.ingredients.map((l, position) => {
          const k = remaining.findIndex((x) => key(x) === key(l));
          if (k >= 0) { const [old] = remaining.splice(k, 1); keepIds.push(old.id); return { id: old.id, position, section: sectionOf(l), oldSection: sectionOf(old) }; }
          const { section, ...rest } = l;
          return { new: { ...rest, position, household_id, recipe_id: recipeId, ...(sectionOf({ section }) ? { section: sectionOf({ section }) } : {}) } };
        });
        if (remaining.length) must(await supabase.from('recipe_ingredients').delete().in('id', remaining.map((x) => x.id)));
        for (const p of plan) {
          if (!('id' in p)) continue;
          if (p.section === p.oldSection) { must(await supabase.from('recipe_ingredients').update({ position: p.position }).eq('id', p.id!)); continue; }
          const res = await supabase.from('recipe_ingredients').update({ position: p.position, section: p.section }).eq('id', p.id!);
          if (res.error && /section/.test(res.error.message)) { sectionsMissing.current = true; must(await supabase.from('recipe_ingredients').update({ position: p.position }).eq('id', p.id!)); }
          else must(res);
        }
        const fresh = plan.filter((p) => 'new' in p).map((p) => p.new!);
        if (fresh.length) must(await insertIngredients(fresh));

        // Steg: oförändrade steg behåller sin koppling till ingredienser.
        const oldSteps = [...r.steps];
        const stepRows = edit.steps.map(normStep).map(({ text, section }, position) => {
          const k = oldSteps.findIndex((x) => x.text === text);
          const ids = k >= 0 ? oldSteps.splice(k, 1)[0].ingredient_ids : null;
          return { text, position, household_id, recipe_id: recipeId, ingredient_ids: ids?.filter((id) => keepIds.includes(Number(id))) ?? null, ...(section?.trim() ? { section: section.trim() } : {}) };
        });
        must(await supabase.from('recipe_steps').delete().eq('recipe_id', recipeId));
        if (stepRows.length) must(await insertRows('recipe_steps', stepRows));

        // Taggar
        const add = edit.tagIds.filter((t) => !r.tagIds.includes(t));
        const del = r.tagIds.filter((t) => !edit.tagIds.includes(t));
        if (del.length) must(await supabase.from('recipe_tags').delete().eq('recipe_id', recipeId).in('tag_id', del));
        if (add.length) must(await supabase.from('recipe_tags').insert(add.map((tag_id) => ({ tag_id, household_id, recipe_id: recipeId }))));
        await reload();
        const usedSections = edit.ingredients.some((i) => i.section?.trim()) || edit.steps.some((x) => typeof x !== 'string' && x.section?.trim());
        if (sectionsMissing.current && usedSections) {
          sectionsMissing.current = false;
          throw new Error('Receptet sparades, men delarna (t.ex. Frosting) kräver migreringen 20261107120000_recipe_sections.sql i Supabase.');
        }
      },
      updateIngredient: async (id: number, patch: Partial<Pick<Ingredient, 'lv_food_id' | 'lv_food_name' | 'match_confidence' | 'grams' | 'lv_manual' | 'amount' | 'amount_max' | 'unit' | 'name'>>) => {
        setData((d) => ({ ...d, recipes: d.recipes.map((r) => ({ ...r, ingredients: r.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)) })) }));
        const res = await supabase.from('recipe_ingredients').update(patch).eq('id', id);
        // Kolumnen lv_manual är valfri: saknas den sparas valet utan markeringen.
        if (res.error && 'amount_max' in patch && /amount_max/.test(res.error.message)) {
          const { amount_max: _a, ...rest } = patch as Partial<Ingredient>;
          must(await supabase.from('recipe_ingredients').update(rest).eq('id', id));
          return;
        }
        if (res.error && 'lv_manual' in patch && /lv_manual/.test(res.error.message)) {
          const { lv_manual: _m, ...rest } = patch;
          must(await supabase.from('recipe_ingredients').update(rest).eq('id', id));
          return;
        }
        must(res);
      },

      addTag: async (name: string) => {
        const household_id = need();
        const tone = TONE_ORDER[data.tags.length % 4];
        const tag = must(await supabase.from('tags').insert({ household_id, name, tone }).select('*').single()) as Tag;
        setData((d) => ({ ...d, tags: [...d.tags, tag] }));
        return tag;
      },
      setTagNoSuggest: async (id: string, on: boolean) => {
        setData((d) => ({ ...d, tags: d.tags.map((x) => (x.id === id ? { ...x, no_suggest: on } : x)) }));
        const res = await supabase.from('tags').update({ no_suggest: on }).eq('id', id);
        if (res.error) {
          setData((d) => ({ ...d, tags: d.tags.map((x) => (x.id === id ? { ...x, no_suggest: !on } : x)) }));
          throw new Error(/no_suggest/.test(res.error.message) ? 'Det här kräver migreringen 20261108120000_tag_no_suggest.sql i Supabase.' : res.error.message);
        }
      },
      cycleTagTone: async (id: string) => {
        const t = data.tags.find((x) => x.id === id);
        if (!t) return;
        const tone: Tone = TONE_ORDER[(TONE_ORDER.indexOf(t.tone) + 1) % 4];
        setData((d) => ({ ...d, tags: d.tags.map((x) => (x.id === id ? { ...x, tone } : x)) }));
        must(await supabase.from('tags').update({ tone }).eq('id', id));
      },
      deleteTag: async (id: string) => {
        // Taggar som något recept har tas inte bort (användarens val).
        const used = data.recipes.filter((r) => r.tagIds.includes(id)).length;
        if (used) throw new Error(`Taggen används i ${used} recept. Ta bort den från recepten först.`);
        setData((d) => ({ ...d, tags: d.tags.filter((x) => x.id !== id), recipes: d.recipes.map((r) => ({ ...r, tagIds: r.tagIds.filter((t) => t !== id) })) }));
        must(await supabase.from('tags').delete().eq('id', id));
      },

      toggleFavorite: async (recipeId: string) => {
        const on = !data.recipes.find((r) => r.id === recipeId)?.is_favorite;
        patchRecipe(recipeId, (r) => ({ ...r, is_favorite: on }));
        const res = await supabase.from('recipes').update({ is_favorite: on }).eq('id', recipeId);
        if (res.error) {
          patchRecipe(recipeId, (r) => ({ ...r, is_favorite: !on }));
          throw new Error(/is_favorite/.test(res.error.message) ? 'Favoriter kräver migreringen 20261103120000_favorites_and_shopping.sql i Supabase.' : res.error.message);
        }
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
  }, [hid, data.tags, data.recipes, loadHousehold, reload, session, extras]);

  const selectHousehold = useCallback((id: string) => {
    const h = households.find((x) => x.id === id);
    if (!h) return;
    localStorage.setItem(HH_KEY, id);
    setHousehold(h);
  }, [households]);

  const memberName = useCallback((userId: string | null | undefined) =>
    (userId ? members.find((m) => m.user_id === userId)?.display_name ?? null : null), [members]);

  const value: Store = { extras, feedback, session, members, memberName, authReady, household, households, selectHousehold, householdLoading, loaded, error, reload, ...data, ...actions };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
