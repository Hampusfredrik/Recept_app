import { Shuffle } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUi } from '../components/uiState';
import { EffortIcons, Ico, Sheet, Thumb } from '../components/ui';
import { byLongestAgo, dayName } from '../lib/logic';
import { daysSince, fromIso, lastLabel, MONTHS_SHORT } from '../lib/dates';

export function PickSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { recipes, setPlan } = useStore();
  const { setSheet } = useUi();
  const d = fromIso(date);
  const list = [...recipes].sort(byLongestAgo);
  return (
    <Sheet onClose={onClose} style={{ gap: 12, maxHeight: 'min(620px, calc(100dvh - 40px))', paddingBottom: 18, overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
        <h3>{dayName(date)} {d.getDate()} {MONTHS_SHORT[d.getMonth()]}</h3>
        <button onClick={() => setSheet({ kind: 'random', pickDate: date })} className="row"
          style={{ gap: 6, height: 38, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--color-accent-100)', color: 'var(--color-accent-900)', cursor: 'pointer', font: '700 13px var(--font-body)' }}>
          <Ico icon={Shuffle} size={15} />Slumpa
        </button>
      </div>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: -6 }}>Sorterat på längst sedan du lagade dem</span>
      <div className="col" style={{ overflowY: 'auto', margin: '0 -8px' }}>
        {list.length === 0 && <span className="muted" style={{ padding: 8 }}>Inga recept än.</span>}
        {list.map((r) => (
          <button key={r.id} className="hover-surface" onClick={async () => { await setPlan(date, r.id); onClose(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, border: 0, borderRadius: 22, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
            <Thumb id={r.id} image={r.image_url} size={48} radius={16} stripeW={5} />
            <span className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, lineHeight: 1.15 }}>{r.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{lastLabel(daysSince(r.last_cooked_on))}</span>
            </span>
            <EffortIcons n={r.effort} size={11} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
