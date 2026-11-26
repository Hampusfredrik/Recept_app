import { yieldShort, yieldText } from '../lib/format';
import type { YieldUnit } from '../lib/types';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, Plus, ShoppingBasket, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUi } from '../components/uiState';
import { EffortIcons, Ico, Sheet, Stepper, useToast, WeekToggle } from '../components/ui';
import { iso, isoWeek, MONTHS_SHORT, today, weekAt, WEEKDAYS_SHORT } from '../lib/dates';

export function Week() {
  const { recipes, plan, setPlan, setPlanPortions, extras, memberName } = useStore();
  const toast = useToast();
  // Eget antal portioner för en dag (t.ex. dubbelt recept); inköpslistan räknar med det.
  const [editPortions, setEditPortions] = useState<{ date: string; name: string; base: number; value: number; unit: YieldUnit } | null>(null);
  const savePortions = (v: number) => {
    if (!editPortions) return;
    setEditPortions({ ...editPortions, value: v });
    setPlanPortions(editPortions.date, v === editPortions.base ? null : v).catch((e) => toast(e instanceof Error ? e.message : String(e)));
  };
  const { setSheet, weekOffset, setWeekOffset } = useUi();
  const nav = useNavigate();
  const days = weekAt(weekOffset);
  const t = today();
  const first = days[0], last = days[6];
  const range = first.getMonth() === last.getMonth()
    ? `${first.getDate()}–${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}`
    : `${first.getDate()} ${MONTHS_SHORT[first.getMonth()]} – ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}`;

  const rows = days.map((d) => {
    const date = iso(d);
    const entry = plan.find((p) => p.date === date);
    return { d, date, r: entry ? recipes.find((x) => x.id === entry.recipe_id) : undefined, portions: entry?.portions ?? null };
  });
  const planned = rows.filter((x) => x.r);
  const heavy = planned.filter((x) => x.r!.effort >= 4).length;
  const summary = planned.length
    ? `${planned.length} ${planned.length === 1 ? 'middag planerad' : 'middagar planerade'} · ${heavy} helgprojekt eller mer`
    : 'Inget planerat än.';

  return (
    <div className="screen narrow">
      <span className="kicker">Vecka {isoWeek(first)} · {range}</span>
      <h1 className="h1" style={{ margin: '2px 0 6px' }}>Veckan</h1>
      <p style={{ margin: '0 0 14px', color: 'var(--color-neutral-700)', fontSize: 14 }}>{summary}</p>
      <div style={{ marginBottom: 16 }}><WeekToggle value={weekOffset} onChange={setWeekOffset} /></div>
      <button onClick={() => nav('/veckan/handla')} className="row"
        style={{ width: '100%', gap: 12, padding: '12px 16px 12px 12px', marginBottom: 16, borderRadius: 24, border: 0, background: 'var(--color-accent-2-100)', color: 'var(--color-accent-2-900)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
        <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-2-600)', display: 'grid', placeItems: 'center' }}><Ico icon={ShoppingBasket} size={18} color="var(--color-bg)" /></span>
        <span className="col" style={{ flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>Inköpslista</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{planned.length ? `Allt ni behöver till veckans ${planned.length === 1 ? 'middag' : `${planned.length} middagar`}` : 'Lägg till egna varor'}{extras.some((e) => !e.checked) ? ` · ${extras.filter((e) => !e.checked).length} egna` : ''}</span>
        </span>
      </button>
      <div className="col" style={{ gap: 8 }}>
        {rows.map(({ d, date, r, portions }, i) => {
          const isToday = date === t, past = date < t;
          const op = past ? 0.55 : 1;
          return (
            <div key={date} className="row" style={{ alignItems: 'stretch', gap: 12 }}>
              <div className="col" style={{ flex: 'none', width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 20, opacity: op,
                background: isToday ? 'var(--color-accent)' : 'var(--color-surface)', color: isToday ? 'var(--color-bg)' : 'var(--color-text)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{WEEKDAYS_SHORT[i]}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, lineHeight: 1.1 }}>{d.getDate()}</span>
              </div>
              {r ? (
                <div className="row" style={{ flex: 1, minWidth: 0, gap: 10, padding: '10px 6px 10px 14px', borderRadius: 22, background: 'var(--color-surface)', opacity: op }}>
                  <div onClick={() => nav(`/recept/${r.id}`)} className="col" style={{ flex: 1, minWidth: 0, gap: 3, cursor: 'pointer' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, lineHeight: 1.15 }}>{r.name}</span>
                    {r.last_cooked_on === date
                      ? <span className="row" style={{ gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--color-accent-2-700)' }}><Ico icon={CircleCheck} size={14} />Lagades den här dagen{memberName(r.last_cooked_by) ? ` av ${memberName(r.last_cooked_by)}` : ''}</span>
                      : <EffortIcons n={r.effort} size={12} />}
                  </div>
                  {(() => {
                    const n = portions ?? r.portions;
                    const changed = n !== r.portions;
                    const u = r.yield_unit ?? 'portion';
                    return (
                      <button onClick={() => setEditPortions({ date, name: r.name, base: r.portions, value: n, unit: u })} aria-label={`${yieldText(n, u)}. Ändra`}
                        style={{ flex: 'none', height: 30, padding: '0 10px', borderRadius: 999, cursor: 'pointer', font: '700 12px var(--font-body)',
                          border: `1.5px solid ${changed ? 'var(--color-alert)' : 'var(--color-divider)'}`, background: changed ? 'var(--color-alert-bg)' : 'transparent', color: changed ? 'var(--color-alert)' : 'var(--color-neutral-800)' }}>
                        {yieldShort(n, u)}
                      </button>
                    );
                  })()}
                  <button className="hover-n300" onClick={() => setPlan(date, null)} aria-label="Ta bort"
                    style={{ flex: 'none', width: 36, height: 36, border: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', color: 'var(--color-neutral-600)', display: 'grid', placeItems: 'center' }}>
                    <Ico icon={X} size={16} />
                  </button>
                </div>
              ) : (
                <button className="hover-surface" onClick={() => setSheet({ kind: 'pick', date })}
                  style={{ flex: 1, minHeight: 62, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderRadius: 22, border: '1.5px dashed var(--color-neutral-400)', background: 'transparent', cursor: 'pointer', font: '600 14px var(--font-body)', color: 'var(--color-neutral-700)', opacity: op }}>
                  <Ico icon={Plus} size={16} />Välj recept
                </button>
              )}
            </div>
          );
        })}
      </div>
      {editPortions && (
        <Sheet onClose={() => setEditPortions(null)} style={{ gap: 14 }}>
          <h3>{editPortions.name}</h3>
          <Stepper label={editPortions.unit === 'st' ? 'Antal den här dagen' : 'Portioner den här dagen'} value={editPortions.value} onChange={savePortions} unit={editPortions.unit}
            alert={editPortions.value !== editPortions.base ? `Receptet är skrivet för ${yieldText(editPortions.base, editPortions.unit)}` : undefined} />
          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Inköpslistan räknar med det här antalet, t.ex. dubbla mängder för dubbelt recept.</span>
          <button className="btn btn-primary btn-block" onClick={() => setEditPortions(null)} style={{ height: 50 }}>Klar</button>
        </Sheet>
      )}
    </div>
  );
}
