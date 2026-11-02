import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, Copy, Plus, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUi } from '../components/uiState';
import { Ico, useToast, WeekToggle } from '../components/ui';
import { fromIso, iso, isoWeek, weekAt } from '../lib/dates';
import { shoppingList, type ShoppingItem } from '../lib/shopping';
import { makeHas } from '../lib/logic';
import { useShoppingChecks } from '../lib/shoppingChecks';
import type { Recipe } from '../lib/types';

export function Shopping() {
  const { recipes, plan, pantry, household, extras, addExtra, toggleExtra, removeExtra, clearCheckedExtras } = useStore();
  const [newItem, setNewItem] = useState('');
  const add = async () => {
    const v = newItem.trim();
    if (!v) return;
    setNewItem('');
    try { await addExtra(v); } catch (e) { setNewItem(v); toast(e instanceof Error ? e.message : String(e)); }
  };
  const run = (p: Promise<void>) => p.catch((e) => toast(e instanceof Error ? e.message : String(e)));
  const extrasDone = extras.filter((e) => e.checked).length;
  const { weekOffset, setWeekOffset } = useUi();
  const nav = useNavigate();
  const toast = useToast();
  const [showDone, setShowDone] = useState(true);
  const days = weekAt(weekOffset).map(iso);
  const weekStart = days[0];
  const { checked, toggle, clear } = useShoppingChecks(household?.id, weekStart);

  const planned = days.map((d) => plan.find((p) => p.date === d)).filter((p) => !!p)
    .map((p) => recipes.find((r) => r.id === p.recipe_id)).filter((r): r is Recipe => !!r);
  const items = shoppingList(planned);
  const has = makeHas(pantry);
  const buy = items.filter((i) => !i.staple && !has(i.name));
  const home = items.filter((i) => i.staple || has(i.name));
  const left = buy.filter((i) => !checked.has(i.key)).length;

  const copy = async () => {
    const lines = [...buy, ...home].filter((i) => !checked.has(i.key)).map((i) => `- ${i.name}${i.amount ? ` (${i.amount})` : ''}`)
      .concat(extras.filter((e) => !e.checked).map((e) => `- ${e.name}`));
    try { await navigator.clipboard.writeText(`Inköpslista vecka ${isoWeek(fromIso(weekStart))}\n${lines.join('\n')}`); toast('Listan är kopierad'); }
    catch { toast('Kunde inte kopiera'); }
  };

  const row = (i: ShoppingItem) => {
    const on = checked.has(i.key);
    if (on && !showDone) return null;
    return (
      <button key={i.key} onClick={() => toggle(i.key)} aria-pressed={on} className="hover-surface"
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 8px', border: 0, borderRadius: 18, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
        <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 9, display: 'grid', placeItems: 'center',
          border: on ? 0 : '2px solid var(--color-neutral-400)', background: on ? 'var(--color-accent-2-600)' : 'transparent', color: 'var(--color-bg)' }}>
          {on && <Ico icon={Check} size={15} />}
        </span>
        <span className="col" style={{ flex: 1, minWidth: 0, gap: 1, opacity: on ? 0.5 : 1 }}>
          <span style={{ fontSize: 15, fontWeight: 600, textDecoration: on ? 'line-through' : undefined }}>
            {i.name.replace(/^./, (c) => c.toUpperCase())}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.recipes.join(' · ')}</span>
        </span>
        <span style={{ flex: 'none', fontSize: 14, fontWeight: 700, color: 'var(--color-neutral-800)', opacity: on ? 0.5 : 1, textAlign: 'right' }}>
          {i.amount}{i.someUnmeasured ? ' +' : ''}
        </span>
      </button>
    );
  };

  return (
    <div className="screen narrow">
      <button className="circle-btn" onClick={() => nav('/veckan')} aria-label="Tillbaka till veckan" style={{ marginBottom: 14 }}><Ico icon={ChevronLeft} size={20} /></button>
      <span className="kicker">Vecka {isoWeek(fromIso(weekStart))}</span>
      <h1 className="h1" style={{ margin: '2px 0 6px' }}>Inköpslista</h1>
      <p style={{ margin: '0 0 14px', color: 'var(--color-neutral-700)', fontSize: 14 }}>
        {planned.length ? `${planned.length} ${planned.length === 1 ? 'middag' : 'middagar'} · ${left + extras.length - extrasDone} ${left + extras.length - extrasDone === 1 ? 'vara' : 'varor'} kvar att köpa` : 'Inga middagar planerade den här veckan.'}
      </p>
      <div style={{ marginBottom: 16 }}><WeekToggle value={weekOffset} onChange={setWeekOffset} /></div>

      {planned.length > 0 && items.length === 0 && <p className="muted">De planerade recepten har inga ingredienser.</p>}

      {buy.length > 0 && (
        <div className="col" style={{ margin: '0 -8px' }}>
          {buy.map(row)}
        </div>
      )}

      <div className="col" style={{ marginTop: buy.length ? 22 : 4 }}>
        <h3 style={{ margin: '0 0 2px', fontSize: 18 }}>Övrigt att köpa</h3>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 8 }}>Egna varor, oberoende av recepten. Ligger kvar tills ni tar bort dem.</span>
        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <input className="input" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="t.ex. diskmedel, kaffe" maxLength={120} enterKeyHint="done" style={{ flex: 1, minWidth: 0 }} />
          <button className="btn btn-primary" onClick={add} disabled={!newItem.trim()} aria-label="Lägg till vara" style={{ flex: 'none', width: 48, height: 48, padding: 0 }}><Ico icon={Plus} size={20} /></button>
        </div>
        <div className="col" style={{ margin: '0 -8px' }}>
          {extras.filter((e) => showDone || !e.checked).map((e) => (
            <div key={e.id} className="row" style={{ gap: 4 }}>
              <button onClick={() => run(toggleExtra(e.id))} aria-pressed={e.checked} className="hover-surface"
                style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', gap: 12, padding: '10px 8px', border: 0, borderRadius: 18, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
                <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 9, display: 'grid', placeItems: 'center',
                  border: e.checked ? 0 : '2px solid var(--color-neutral-400)', background: e.checked ? 'var(--color-accent-2-600)' : 'transparent', color: 'var(--color-bg)' }}>
                  {e.checked && <Ico icon={Check} size={15} />}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, opacity: e.checked ? 0.5 : 1, textDecoration: e.checked ? 'line-through' : undefined, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.name.replace(/^./, (c) => c.toUpperCase())}
                </span>
              </button>
              <button className="hover-n300" onClick={() => run(removeExtra(e.id))} aria-label={`Ta bort ${e.name}`}
                style={{ flex: 'none', width: 36, height: 36, border: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', color: 'var(--color-neutral-600)', display: 'grid', placeItems: 'center' }}>
                <Ico icon={X} size={16} />
              </button>
            </div>
          ))}
        </div>
        {extrasDone > 0 && <button className="btn btn-ghost" onClick={() => run(clearCheckedExtras())} style={{ alignSelf: 'flex-start', height: 40 }}>Ta bort avbockade egna varor</button>}
      </div>

      {home.length > 0 && (
        <div className="col" style={{ marginTop: 22 }}>
          <h3 style={{ margin: '0 0 2px', fontSize: 18 }}>Har ni hemma?</h3>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 6 }}>Kryddor, olja, socker, mjöl, soja, sirap och det som finns i ert skafferi</span>
          <div className="col" style={{ margin: '0 -8px' }}>{home.map(row)}</div>
        </div>
      )}

      {(items.length > 0 || extras.length > 0) && (
        <div className="row" style={{ gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={copy} style={{ height: 44, padding: '0 16px' }}><Ico icon={Copy} size={16} style={{ marginRight: 6 }} />Kopiera listan</button>
          {(checked.size > 0 || extrasDone > 0) && <button className="btn btn-ghost" onClick={() => setShowDone((x) => !x)} style={{ height: 44 }}>{showDone ? 'Dölj avbockade' : 'Visa avbockade'}</button>}
          {checked.size > 0 && <button className="btn btn-ghost" onClick={clear} style={{ height: 44 }}>Avmarkera alla</button>}
        </div>
      )}
      {items.some((i) => i.someUnmeasured) && (
        <p style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 16 }}>+ betyder att minst ett recept inte anger någon mängd.</p>
      )}
    </div>
  );
}
