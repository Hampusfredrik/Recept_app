import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUi } from '../components/uiState';
import { EffortIcons, Ico, WeekToggle } from '../components/ui';
import { iso, isoWeek, MONTHS_SHORT, today, weekAt, WEEKDAYS_SHORT } from '../lib/dates';

export function Week() {
  const { recipes, plan, setPlan } = useStore();
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
    return { d, date, r: entry ? recipes.find((x) => x.id === entry.recipe_id) : undefined };
  });
  const planned = rows.filter((x) => x.r);
  const heavy = planned.filter((x) => x.r!.effort >= 4).length;
  const summary = planned.length
    ? `${planned.length} ${planned.length === 1 ? 'middag planerad' : 'middagar planerade'} · ${heavy} helgprojekt eller mer`
    : 'Inget planerat än.';

  return (
    <div className="screen">
      <span className="kicker">Vecka {isoWeek(first)} · {range}</span>
      <h1 className="h1" style={{ margin: '2px 0 6px' }}>Veckan</h1>
      <p style={{ margin: '0 0 14px', color: 'var(--color-neutral-700)', fontSize: 14 }}>{summary}</p>
      <div style={{ marginBottom: 16 }}><WeekToggle value={weekOffset} onChange={setWeekOffset} /></div>
      <div className="col" style={{ gap: 8 }}>
        {rows.map(({ d, date, r }, i) => {
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
                    <EffortIcons n={r.effort} size={12} />
                  </div>
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
    </div>
  );
}
