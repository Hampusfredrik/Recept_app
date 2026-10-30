import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Shuffle } from 'lucide-react';
import { useStore } from '../lib/store';
import { EffortPicker, Ico, Sheet, Thumb } from '../components/ui';
import { dayName, toggle } from '../lib/logic';
import { daysSince, lastLabel } from '../lib/dates';
import { EFFORT } from '../lib/format';

export function RandomSheet({ onClose, pickDate }: { onClose: () => void; pickDate?: string }) {
  const { recipes, tags, setPlan } = useStore();
  const nav = useNavigate();
  const [eff, setEff] = useState<number[]>([]);
  const [tagSel, setTagSel] = useState<string[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const [none, setNone] = useState(false);

  const pool = recipes.filter((r) => (!eff.length || eff.includes(r.effort)) && (!tagSel.length || tagSel.some((t) => r.tagIds.includes(t))));
  const res = resultId ? recipes.find((r) => r.id === resultId) : undefined;
  const reset = () => { setResultId(null); setNone(false); };

  const roll = () => {
    if (!pool.length) { setResultId(null); setNone(true); return; }
    const others = pool.filter((r) => r.id !== resultId);
    const from = others.length ? others : pool;
    setResultId(from[Math.floor(Math.random() * from.length)].id);
    setNone(false);
  };

  return (
    <Sheet onClose={onClose}>
      <h3>Slumpa ett recept</h3>
      <div className="col" style={{ gap: 8 }}>
        <span className="label">Insats · lämna tomt för alla</span>
        <EffortPicker value={eff} onChange={(n) => { setEff((e) => toggle(e, n)); reset(); }} height={52} radius={20} iconSize={16} fontSize={12} />
      </div>
      <div className="col" style={{ gap: 8 }}>
        <span className="label">Taggar</span>
        <div className="wrap">{tags.map((t) => <button key={t.id} className={'chip' + (tagSel.includes(t.id) ? ' on' : '')} onClick={() => { setTagSel((s) => toggle(s, t.id)); reset(); }}>{t.name}</button>)}</div>
      </div>
      {res && (
        <div onClick={() => { onClose(); nav(`/recept/${res.id}`); }} className="row" style={{ gap: 12, padding: 10, borderRadius: 26, background: 'var(--color-surface)', cursor: 'pointer', animation: 'rup .25s ease-out' }}>
          <Thumb id={res.id} image={res.image_url} size={64} radius={20} />
          <div className="col" style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, lineHeight: 1.1 }}>{res.name}</span>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{EFFORT[res.effort]} · {lastLabel(daysSince(res.last_cooked_on))}</span>
          </div>
          <Ico icon={ArrowUpRight} color="var(--color-accent-700)" style={{ marginRight: 6 }} />
        </div>
      )}
      {none && <div style={{ padding: '12px 16px', borderRadius: 22, background: 'var(--color-accent-100)', color: 'var(--color-accent-900)', fontSize: 14 }}>Inget recept matchar. Prova färre val.</div>}
      <div className="row" style={{ gap: 8 }}>
        {pickDate && res && (
          <button className="btn btn-secondary" onClick={async () => { await setPlan(pickDate, res.id); onClose(); }} style={{ height: 52, flex: 1, fontSize: 16 }}>
            Välj för {dayName(pickDate).toLowerCase()}
          </button>
        )}
        <button className="btn btn-primary" onClick={roll} style={{ height: 52, flex: 1, fontSize: 16 }}>
          <Ico icon={Shuffle} />{res ? 'Slumpa igen' : `Slumpa bland ${pool.length}`}
        </button>
      </div>
    </Sheet>
  );
}
