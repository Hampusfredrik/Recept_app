import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useStore } from '../lib/store';
import { EffortField, Ico, TagChooser } from './ui';
import { toggle } from '../lib/logic';
import { estimateKcal } from '../lib/nutrition';

/** Insats + taggar, gemensamt för alla lägg-till-flöden. */
export function useSaveFields() {
  const [effort, setEffort] = useState(0);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [effortErr, setEffortErr] = useState(false);
  const { tags } = useStore();
  const fields = (
    <>
      <EffortField value={effort} onChange={(n) => { setEffort(n); setEffortErr(false); }} error={effortErr} />
      <TagChooser tags={tags} selected={tagIds} onToggle={(id) => setTagIds((t) => toggle(t, id))} />
    </>
  );
  const check = () => { if (!effort) { setEffortErr(true); return false; } return true; };
  return { effort, tagIds, fields, check };
}

export function BookSuggestions({ onPick, extra = [] }: { onPick: (b: string) => void; extra?: string[] }) {
  const { recipes } = useStore();
  const books = [...new Set([...recipes.filter((r) => r.source_type === 'book' && r.book_title).map((r) => r.book_title!), ...extra])];
  if (!books.length) return null;
  return (
    <div className="wrap" style={{ marginTop: -6 }}>
      {books.map((b) => (
        <button key={b} type="button" onClick={() => onPick(b)} className="row"
          style={{ gap: 6, height: 32, padding: '0 12px', borderRadius: 999, border: 0, cursor: 'pointer', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', font: '600 13px var(--font-body)' }}>
          <Ico icon={BookOpen} size={14} />{b}
        </button>
      ))}
    </div>
  );
}

export function KcalEstimate({ lines, portions }: { lines: { amount: number | null; unit: string; name: string }[]; portions: number }) {
  const [state, setState] = useState<{ v: number | null; done: boolean }>({ v: null, done: false });
  const key = JSON.stringify([lines, portions]);
  useEffect(() => {
    let alive = true;
    setState({ v: null, done: false });
    estimateKcal(lines, portions).then((v) => alive && setState({ v, done: true })).catch(() => alive && setState({ v: null, done: true }));
    return () => { alive = false; };
  }, [key]);
  return (
    <div className="row" style={{ justifyContent: 'space-between', gap: 10, padding: '14px 16px', borderRadius: 24, border: '1.5px solid var(--color-divider)' }}>
      <span className="col"><span style={{ fontWeight: 700, fontSize: 14 }}>Näringsvärde</span><span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Beräknas mot Livsmedelsverket</span></span>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20 }}>{!state.done ? '…' : state.v == null ? '–' : `≈ ${state.v} kcal`}</span>
    </div>
  );
}
