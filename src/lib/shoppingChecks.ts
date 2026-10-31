import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const LOCAL = (hid: string, week: string) => `receptappen.shop.${hid}.${week}`;

/**
 * Avbockade varor i veckans inköpslista. Delas i köket via tabellen shopping_checks;
 * finns inte tabellen sparas de bara på den här enheten.
 */
export function useShoppingChecks(householdId: string | undefined, weekStart: string) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const local = useRef(false);

  const load = useCallback(async () => {
    if (!householdId) return;
    const { data, error } = await supabase.from('shopping_checks').select('item_key').eq('household_id', householdId).eq('week_start', weekStart);
    if (error) {
      local.current = true;
      setChecked(new Set(JSON.parse(localStorage.getItem(LOCAL(householdId, weekStart)) ?? '[]') as string[]));
      return;
    }
    local.current = false;
    setChecked(new Set((data ?? []).map((d) => d.item_key as string)));
  }, [householdId, weekStart]);

  useEffect(() => {
    void load();
    // Den andra i köket kan handla samtidigt: läs om när appen visas igen och med jämna mellanrum.
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 15000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(t); };
  }, [load]);

  const toggle = useCallback(async (key: string) => {
    if (!householdId) return;
    let on = false;
    setChecked((s) => {
      const n = new Set(s);
      on = !n.has(key);
      if (on) n.add(key); else n.delete(key);
      if (local.current) localStorage.setItem(LOCAL(householdId, weekStart), JSON.stringify([...n]));
      return n;
    });
    if (local.current) return;
    const res = on
      ? await supabase.from('shopping_checks').upsert({ household_id: householdId, week_start: weekStart, item_key: key })
      : await supabase.from('shopping_checks').delete().eq('household_id', householdId).eq('week_start', weekStart).eq('item_key', key);
    if (res.error) void load();
  }, [householdId, weekStart, load]);

  const clear = useCallback(async () => {
    if (!householdId) return;
    setChecked(new Set());
    if (local.current) { localStorage.removeItem(LOCAL(householdId, weekStart)); return; }
    await supabase.from('shopping_checks').delete().eq('household_id', householdId).eq('week_start', weekStart);
  }, [householdId, weekStart]);

  return { checked, toggle, clear };
}
