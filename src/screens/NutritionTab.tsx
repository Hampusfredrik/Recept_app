import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../lib/store';
import { Ico, Sheet, Spinner, useToast } from '../components/ui';
import { ML_PER_UNIT } from '../data/units';
import { STOCK_CUBE_SALT_G } from '../data/pieceWeights';
import { computeNutrition, isNegligible, fetchNutrients, rematchAll, fetchUnitWeights, foodList, matchFood, matchMissing, saveUnitWeight, toGrams, weightUnit, type LvFood, type Per100 } from '../lib/nutrition';
import { forNutrition } from '../lib/english';
import { amountLabel, fmt } from '../lib/format';
import { NNR } from '../data/nnr';
import type { Ingredient, Recipe } from '../lib/types';

export function NutritionTab({ r }: { r: Recipe }) {
  const { updateIngredient, household } = useStore();
  const [foods, setFoods] = useState<Map<number, Per100> | null>(null);
  const [weights, setWeights] = useState<Map<string, number>>(new Map());
  const [err, setErr] = useState('');
  const [lvErrors, setLvErrors] = useState<string[]>([]);
  const [swap, setSwap] = useState<Ingredient | null>(null);

  const idsKey = r.ingredients.map((i) => `${i.id}:${i.lv_food_id ?? ''}:${i.match_confidence ?? ''}`).join(',');

  useEffect(() => {
    if (!r.ingredients.length) return;
    let alive = true;
    (async () => {
      try {
        setErr('');
        await matchMissing(r.ingredients, updateIngredient);
        const ids = [...new Set(r.ingredients.map((i) => i.lv_food_id).filter((x): x is number => x != null))];
        const [f, w] = await Promise.all([fetchNutrients(ids), fetchUnitWeights(ids, household?.id)]);
        if (alive) { setFoods(f.map); setLvErrors(f.errors); setWeights(w); }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { alive = false; };
  }, [idsKey]);

  const reloadWeights = async () => {
    const ids = [...new Set(r.ingredients.map((i) => i.lv_food_id).filter((x): x is number => x != null))];
    setWeights(await fetchUnitWeights(ids, household?.id));
  };

  // Engelska recept: svenska namn och mått för matchning och beräkning (receptet visas som det skrevs).
  const sv = useMemo(() => forNutrition(r.ingredients), [r.ingredients]);
  const english = sv !== r.ingredients;
  const res = useMemo(() => (foods ? computeNutrition(sv, r.portions, foods, weights) : null), [foods, weights, sv, r.portions]);

  if (!r.ingredients.length) {
    return (
      <div className="col" style={{ alignItems: 'flex-start', gap: 10, padding: 18, borderRadius: 28, background: 'var(--color-accent-2-100)', color: 'var(--color-accent-2-900)' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>Inget näringsvärde än</span>
        <p style={{ margin: 0, fontSize: 14 }}>Näringen räknas ut från ingredienserna. Skriv in dem från boken så matchar vi mot Livsmedelsverkets databas.</p>
      </div>
    );
  }
  if (err) return <div style={{ padding: 18, borderRadius: 28, background: 'var(--color-accent-100)', color: 'var(--color-accent-900)', fontSize: 14 }}>Kunde inte hämta näringsvärden: {err}</div>;
  if (!res) {
    return (
      <div className="col skeleton" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 10 }}><Spinner /><span style={{ fontWeight: 600 }}>Matchar mot Livsmedelsverket…</span></div>
        <div style={{ height: 96, borderRadius: 30, background: 'var(--color-surface)' }} />
        <div style={{ height: 160, borderRadius: 24, background: 'var(--color-surface)' }} />
      </div>
    );
  }

  const n = res.perPortion;
  const kcal = n.kcal ?? 0;
  const macro = (label: string, g: number | undefined, kcalPer: number, color: string, max: number) => ({
    label, val: `${fmt(g ?? 0)} g`, pct: Math.min(100, Math.round((g ?? 0) / max * 100)), color,
    sub: kcalPer ? (kcal ? `${Math.round((g ?? 0) * kcalPer / kcal * 100)} E%` : '– E%') : 'Rek. 25–35 g/dag',
  });
  const macros = [
    macro('Protein', n.protein, 4, 'var(--color-accent-2-600)', 50),
    macro('Fett', n.fat, 9, 'var(--color-accent)', 70),
    macro('Kolhydrater', n.carbs, 4, 'var(--color-neutral-600)', 90),
    macro('Fiber', n.fiber, 0, 'var(--color-accent-2-500)', 30),
  ];

  const missingNut = res.counted === 0 || n.kcal == null;
  const unmatched = res.noFood.filter((i) => i.lv_food_id == null).length;
  const noValues = res.noFood.length - unmatched;
  return (
    <div className="col" style={{ gap: 16 }}>
      {missingNut && (
        <div className="col" style={{ gap: 6, padding: 18, borderRadius: 28, background: 'var(--color-accent-100)', color: 'var(--color-accent-900)' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>Näringsvärdet kunde inte räknas ut</span>
          <span style={{ fontSize: 14 }}>
            {res.counted === 0
              ? [
                  unmatched ? `${unmatched} ingredienser hittades inte i Livsmedelsverkets lista.` : '',
                  noValues ? `${noValues} fick inga näringsvärden från Livsmedelsverket.` : '',
                  res.noWeight.length ? `${res.noWeight.length} saknar vikt.` : '',
                ].filter(Boolean).join(' ')
              : 'Livsmedelsverkets svar innehöll inget energivärde.'}
            {' '}Tryck på en ingrediens nedan för att byta livsmedel eller ange vikt.
          </span>
          {lvErrors.length > 0 && (
            <span style={{ fontSize: 12, fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-word', opacity: 0.85 }}>Fel från Livsmedelsverket: {lvErrors[0]}</span>
          )}
        </div>
      )}
      {household && <WeightPrompts items={[...res.noWeight, ...res.assumed].filter((i) => !isNegligible(i))} householdId={household.id} onSaved={reloadWeights} />}
      {res.counted > 0 && (<>
      <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'space-between', padding: '18px 20px', borderRadius: 30, background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)' }}>
        <div className="col">
          <span style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>Per portion</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 46, lineHeight: 1 }}>{Math.round(kcal)}<span style={{ fontSize: 20 }}> kcal</span></span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{Math.round(kcal * 4.184)} kJ</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {macros.map((m) => (
          <div key={m.label} className="col" style={{ gap: 6, padding: 14, borderRadius: 24, background: 'var(--color-surface)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', fontWeight: 600 }}>{m.label}</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 22, lineHeight: 1 }}>{m.val}</span>
            <div className="bar"><div style={{ width: `${m.pct}%`, background: m.color }} /></div>
            <span style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{m.sub}</span>
          </div>
        ))}
      </div>

      <div className="col" style={{ gap: 2 }}>
        <h4 style={{ margin: '8px 0 2px', fontSize: 19 }}>Vitaminer och mineraler</h4>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 6 }}>Andel av dagligt referensintag (NNR) per portion</span>
        {NNR.map((m) => {
          const v = n[m.key as keyof Per100];
          const p = v == null ? null : Math.round(v / m.ref * 100);
          return (
            <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 64px', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</span>
              <div className="bar"><div style={{ width: `${Math.min(100, p ?? 0)}%`, background: (p ?? 0) >= 30 ? 'var(--color-accent-2-600)' : 'var(--color-accent-2-400)' }} /></div>
              <span style={{ fontSize: 12, textAlign: 'right', color: 'var(--color-neutral-800)' }}><b>{p == null ? '–' : `${p}%`}</b><br />{v == null ? 'saknas' : `${fmt(v)} ${m.unit}`}</span>
            </div>
          );
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
          {([['Salt', n.salt], ['Socker', n.sugar], ['Mättat fett', n.satfat]] as const).map(([label, v]) => (
            <div key={label} className="col" style={{ padding: '10px 12px', borderRadius: 18, border: '1.5px solid var(--color-divider)' }}>
              <span style={{ fontSize: 11, color: 'var(--color-neutral-700)', fontWeight: 600 }}>{label}</span><span style={{ fontWeight: 700 }}>{v == null ? '–' : `${fmt(v)} g`}</span>
            </div>
          ))}
        </div>
        {res.saltBy.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 8 }}>
            Saltet per portion kommer från: {res.saltBy.map((x) => `${x.name} ${fmt(x.grams)} g`).join(' · ')}
          </span>
        )}
      </div>
      </>)}

      <div className="col" style={{ gap: 2 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <h4 style={{ margin: '8px 0 2px', fontSize: 19 }}>Matchat mot Livsmedelsverket</h4>
          <RematchButton r={r} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 6 }}>Varje ingrediens kopplas till ett livsmedel i databasen. Tryck för att byta.
          {english && ' Receptet är på engelska: ingredienserna översätts till svenska för matchningen, och amerikanska mått (cup, tbsp, tsp, oz, lb) räknas om.'}</span>
        {r.ingredients.map((i) => {
          const sure = i.match_confidence === 'sure' && i.lv_food_id != null;
          const noWeight = res.noWeight.some((x) => x.id === i.id);
          const ignored = res.ignored.some((x) => x.id === i.id);
          const cube = res.stockCubes.some((x) => x.id === i.id);
          return (
            <button key={i.id} onClick={() => setSwap(i)} className="row"
              style={{ gap: 10, padding: '9px 0', border: 0, borderBottom: '1px solid var(--color-divider)', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)', font: 'inherit' }}>
              <div className="col" style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14 }}>{[amountLabel(i.amount, i.unit, 1, i.amount_max), i.name].filter(Boolean).join(' ')}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{cube
                  ? `Räknas bara som salt: ${fmt(STOCK_CUBE_SALT_G)} g per tärning`
                  : ignored
                  ? (i.amount == null ? 'Räknas inte (ingen mängd)' : 'Räknas inte (krydda, salt eller vatten)')
                  : <>→ {i.lv_food_name ?? 'Ingen träff'}{noWeight ? ' · vikt saknas' : ''}</>}</span>
              </div>
              {!ignored && !cube && <span className="tag" style={{ flex: 'none', fontWeight: 600, background: sure ? 'var(--color-accent-2-100)' : 'var(--color-accent-100)', color: sure ? 'var(--color-accent-2-800)' : 'var(--color-accent-800)' }}>{sure ? 'Säker' : 'Osäker'}</span>}
            </button>
          );
        })}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-700)' }}>
        Källa: Livsmedelsverkets livsmedelsdatabas. Värdena är uppskattningar baserade på råvarorna.
        {res.noWeight.length + res.noFood.length > 0 && ` ${res.noWeight.length + res.noFood.length} av ${r.ingredients.length} ingredienser räknas inte med (saknar livsmedel eller vikt).`}
        {res.ignored.length > 0 && ` Kryddor, salt och vatten som saknas i databasen räknas inte med.`}
        {res.stockCubes.length > 0 && ` Buljongtärningar räknas bara som salt (${fmt(STOCK_CUBE_SALT_G)} g per tärning).`}
        {res.assumedDensity > 0 && ' Volymmått räknas om med 1 g/ml där livsmedlet saknar egen vikt.'}
        {res.standard.length > 0 && ' Vikter per styck och per dl kommer från Livsmedelsverket (PM 2024) och Mattilsynet m.fl. (Mål, vekt og porsjonsstørrelser for matvarer, 2015), utom lök, morot, ägg, citron och burkar (krossade tomater 400 g, bönor 230 g, majs 200 g) som är era egna värden. Egna vikter går alltid före.'}
      </p>

      {swap && <FoodSheet ing={swap} sv={sv.find((x) => x.id === swap.id)} onClose={() => setSwap(null)} weights={weights} />}
    </div>
  );
}

function FoodSheet({ ing, sv, onClose, weights }: { ing: Ingredient; sv?: Ingredient; onClose: () => void; weights: Map<string, number> }) {
  const { updateIngredient } = useStore();
  const [list, setList] = useState<LvFood[] | null>(null);
  const [q, setQ] = useState(sv?.name ?? ing.name);
  const [grams, setGrams] = useState(ing.grams != null ? String(ing.grams) : '');
  useEffect(() => { foodList().then(setList).catch(() => setList([])); }, []);

  const hits = useMemo(() => {
    if (!list) return [];
    const ql = q.trim().toLowerCase();
    if (!ql) return [];
    const words = ql.split(/\s+/);
    const direct = list.filter((f) => words.every((w) => f.name.toLowerCase().includes(w))).slice(0, 30);
    if (direct.length) return direct;
    const m = matchFood(q, list);
    return m ? [m.food] : [];
  }, [list, q]);

  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (patch: Parameters<typeof updateIngredient>[1], done: string) => {
    setBusy(true);
    try { await updateIngredient(ing.id, patch); toast(done); onClose(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Kunde inte spara'); setBusy(false); if (patch.lv_food_id != null) onClose(); }
  };
  const choose = (f: LvFood) => run({ lv_food_id: f.id, lv_food_name: f.name, match_confidence: 'sure', lv_manual: true }, `Kopplad till ${f.name}`);
  const saveGrams = () => {
    const g = parseFloat(grams.replace(',', '.'));
    return run({ grams: Number.isFinite(g) && g > 0 ? g : null }, 'Vikten är sparad');
  };
  const est = toGrams({ ...(sv ?? ing), grams: null }, weights).grams;

  return (
    <Sheet onClose={onClose} className="sheet-top" style={{ gap: 12 }}>
      <h3>Byt livsmedel</h3>
      <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: -6 }}>{[amountLabel(ing.amount, ing.unit, 1, ing.amount_max), ing.name].filter(Boolean).join(' ')}</span>
      <label className="row" style={{ gap: 10, height: 48, padding: '0 16px', borderRadius: 999, background: 'var(--color-surface)', color: 'var(--color-neutral-700)' }}>
        <Ico icon={Search} />
        <input value={q} type="search" enterKeyHint="search" onChange={(e) => setQ(e.target.value)} placeholder="Sök livsmedel"
          style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, color: 'var(--color-text)', outline: 'none' }} />
      </label>
      <div className="col" style={{ maxHeight: 260, overflowY: 'auto', margin: '0 -8px' }}>
        {!list && <div className="row" style={{ gap: 8, padding: 8 }}><Spinner /> Laddar livsmedel…</div>}
        {list && hits.length === 0 && <span className="muted" style={{ padding: 8, fontSize: 14 }}>Inga träffar.</span>}
        {hits.map((f) => (
          <button key={f.id} className="hover-surface" disabled={busy}
            // Hindrar att trycket bara stänger tangentbordet (och flyttar arket) på iPhone.
            onPointerDown={(e) => e.preventDefault()} onClick={() => choose(f)}
            style={{ textAlign: 'left', padding: '10px 8px', border: 0, borderRadius: 16, background: f.id === ing.lv_food_id ? 'var(--color-accent-2-100)' : 'transparent', cursor: 'pointer', font: '15px var(--font-body)', color: 'var(--color-text)' }}>
            {f.name}
          </button>
        ))}
      </div>
      <div className="col" style={{ gap: 6 }}>
        <span className="label">Vikt i gram (valfritt){est != null ? ` · beräknat ${fmt(est)} g` : ''}</span>
        <div className="row" style={{ gap: 8 }}>
          <input className="input big" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder={est != null ? fmt(est) : 't.ex. 120'} />
          <button className="btn btn-secondary" onClick={saveGrams} style={{ flex: 'none', height: 48, padding: '0 18px' }}>Spara</button>
        </div>
      </div>
    </Sheet>
  );
}

const unitLabel = (u: string) => (u.trim() ? u.trim() : 'st');

/** Frågar efter vikt för 1 enhet (t.ex. 1 st gul lök). Sparas i köket och gäller alla recept. */
function WeightPrompts({ items, householdId, onSaved }: { items: Ingredient[]; householdId: string; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // En rad per livsmedel och enhet (volym delar rad, eftersom den sparas per dl).
  const seen = new Set<string>();
  const rows = items.filter((i) => {
    if (i.lv_food_id == null) return false;
    const k = `${i.lv_food_id}:${weightUnit(i.unit)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!rows.length) return null;

  const save = async (i: Ingredient) => {
    const k = `${i.lv_food_id}:${weightUnit(i.unit)}`;
    const g = parseFloat((vals[k] ?? '').replace(',', '.'));
    if (!Number.isFinite(g) || g <= 0) return;
    setBusy(k);
    try {
      await saveUnitWeight(householdId, i.lv_food_id!, i.unit || 'st', g);
      await onSaved();
      toast('Vikten är sparad');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Tabellen finns inte förrän SQL-filen för vikter har körts i Supabase.
      toast(/household_unit_weights|schema cache|does not exist/i.test(msg) ? 'Vikten sparades inte: kör SQL-filen för vikter i Supabase' : 'Kunde inte spara vikten');
      console.error(e);
    }
    setBusy(null);
  };

  return (
    <div className="col" style={{ gap: 8 }}>
      <h4 style={{ margin: '8px 0 0', fontSize: 19 }}>Vikter att fylla i</h4>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: -4 }}>
        Väg gärna eller titta på förpackningen. Vikten sparas i köket och används i alla recept med samma livsmedel.
      </span>
      {rows.map((i) => {
        const k = `${i.lv_food_id}:${weightUnit(i.unit)}`;
        const unit = unitLabel(i.unit);
        const volume = weightUnit(i.unit) === 'dl';
        return (
          <div key={k} className="col" style={{ gap: 6, padding: '12px 14px', borderRadius: 22, background: 'var(--color-surface)' }}>
            <span style={{ fontSize: 14 }}>
              <b>{i.name}</b>: vikt för 1 {unit}
              {volume && <span style={{ color: 'var(--color-neutral-700)' }}> (räknas nu som {fmt(ML_PER_UNIT[i.unit.toLowerCase()] ?? 0)} g, 1 g/ml)</span>}
            </span>
            <div className="row" style={{ gap: 8 }}>
              <label className="row" style={{ flex: 1, gap: 6, height: 44, padding: '0 16px', borderRadius: 999, background: 'var(--color-bg)', border: '1px solid var(--color-divider)' }}>
                <input inputMode="decimal" value={vals[k] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && save(i)} placeholder="t.ex. 150"
                  style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, outline: 'none', color: 'var(--color-text)' }} />
                <span style={{ color: 'var(--color-neutral-700)', fontSize: 14 }}>g</span>
              </label>
              <button className="btn btn-primary" disabled={busy === k || !(vals[k] ?? '').trim()} onClick={() => save(i)} style={{ flex: 'none', height: 44, padding: '0 16px' }}>Spara</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Kopplar om alla ingredienser i receptet med de senaste matchningsreglerna. */
function RematchButton({ r }: { r: Recipe }) {
  const { updateIngredient } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!confirm('Matcha om alla ingredienser i receptet med de senaste reglerna? Livsmedel du har valt själv kan också ändras.')) return;
    setBusy(true);
    try {
      const n = await rematchAll(r.ingredients, updateIngredient);
      toast(n ? `${n} ${n === 1 ? 'ingrediens' : 'ingredienser'} kopplades om` : 'Alla kopplingar var redan aktuella');
    } catch (e) { toast(e instanceof Error ? e.message : 'Kunde inte matcha om'); }
    setBusy(false);
  };
  return (
    <button className="btn btn-ghost" onClick={run} disabled={busy} style={{ flex: 'none', color: 'var(--color-accent-700)', fontSize: 13 }}>
      {busy ? <Spinner size={14} border={2} /> : 'Matcha om'}
    </button>
  );
}
