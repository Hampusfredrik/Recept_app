import { useRef, useState } from 'react';
import { ArrowUp, GripVertical } from 'lucide-react';
import { Ico } from './ui';
import { stepsFromText } from '../../supabase/functions/_shared/parse';

type Step = { text: string; section: string | null };

/** Stegen som text igen: delrubriker som "Sås:" och numrering per del, så att stepsFromText läser dem likadant. */
export function stepsToText(steps: Step[]): string {
  const out: string[] = [];
  let section: string | null = null;
  let n = 0;
  for (const s of steps) {
    if (s.section !== section) { section = s.section; n = 0; if (section) out.push(`${section}:`); }
    out.push(`${++n}. ${s.text}`);
  }
  return out.join('\n');
}

/**
 * Stegen som appen hittade i texten. Dra ett steg till ett annat (eller tryck på pilen) för att
 * slå ihop dem, t.ex. när en radbrytning i boken har delat ett steg i två.
 */
export function StepPreview({ text, onChange }: { text: string; onChange: (t: string) => void }) {
  const steps = stepsFromText(text);
  const [drag, setDrag] = useState<{ from: number; dy: number; over: number | null } | null>(null);
  const start = useRef(0);
  if (steps.length < 2) return null;

  const merge = (a: number, b: number) => {
    const i = Math.min(a, b), j = Math.max(a, b);
    const next = steps.map((s, k) => (k === i ? { ...s, text: `${s.text} ${steps[j].text}`.replace(/\s+/g, ' ').trim() } : s)).filter((_, k) => k !== j);
    onChange(stepsToText(next));
  };

  const overAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-step]');
    return el ? Number(el.getAttribute('data-step')) : null;
  };

  return (
    <div className="col" style={{ gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{steps.length} steg hittades. Dra ett steg till ett annat för att slå ihop dem.</span>
      {steps.map((s, k) => {
        const dragging = drag?.from === k;
        const target = drag && drag.over === k && drag.from !== k;
        return (
          <div key={k} data-step={k} className="row"
            style={{ gap: 8, alignItems: 'flex-start', padding: '8px 8px 8px 4px', borderRadius: 16, position: 'relative',
              background: target ? 'var(--color-accent-2-100)' : 'var(--color-surface)',
              outline: target ? '2px dashed var(--color-accent-2-600)' : 'none',
              transform: dragging ? `translateY(${drag!.dy}px)` : undefined, zIndex: dragging ? 2 : undefined,
              boxShadow: dragging ? 'var(--shadow-md)' : undefined, opacity: dragging ? 0.9 : 1 }}>
            <span aria-label="Dra för att slå ihop" role="button"
              onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); start.current = e.clientY; setDrag({ from: k, dy: 0, over: null }); }}
              onPointerMove={(e) => { if (drag?.from === k) setDrag({ from: k, dy: e.clientY - start.current, over: overAt(e.clientX, e.clientY) }); }}
              onPointerUp={() => { if (drag && drag.over != null && drag.over !== drag.from) merge(drag.from, drag.over); setDrag(null); }}
              onPointerCancel={() => setDrag(null)}
              style={{ flex: 'none', width: 28, height: 32, display: 'grid', placeItems: 'center', cursor: 'grab', touchAction: 'none', color: 'var(--color-neutral-600)' }}>
              <Ico icon={GripVertical} size={18} />
            </span>
            <span style={{ flex: 'none', width: 24, height: 24, marginTop: 4, borderRadius: '50%', background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>{k + 1}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.4, paddingTop: 5 }}>
              {s.section && (k === 0 || steps[k - 1].section !== s.section) && <b style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-700)' }}>{s.section}</b>}
              {s.text}
            </span>
            {k > 0 && (
              <button type="button" onClick={() => merge(k - 1, k)} aria-label={`Slå ihop steg ${k + 1} med steg ${k}`} title="Slå ihop med steget ovanför"
                style={{ flex: 'none', width: 32, height: 32, border: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', color: 'var(--color-neutral-600)', display: 'grid', placeItems: 'center' }}>
                <Ico icon={ArrowUp} size={16} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
