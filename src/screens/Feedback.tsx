import { useState } from 'react';
import { Check, Copy, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { Ico, useToast } from '../components/ui';
import { shortDate } from '../lib/dates';
import type { Feedback as Item } from '../lib/types';

/** Förslag på ändringar i appen. Delas i köket och bockas av när de är fixade. */
export function Feedback() {
  const { feedback, addFeedback, setFeedbackDone, removeFeedback, memberName } = useStore();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const open = feedback.filter((f) => !f.done_at);
  const done = feedback.filter((f) => f.done_at).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));
  const run = (p: Promise<void>, ok?: string) => p.then(() => { if (ok) toast(ok); }, (e) => toast(e instanceof Error ? e.message : String(e)));

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try { await addFeedback(text); setText(''); toast('Förslaget är sparat'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  const copy = async () => {
    const lines = open.map((f) => `- ${f.text.replace(/\s*\n\s*/g, ' ')}`);
    try { await navigator.clipboard.writeText(`Förslag till Receptappen:\n${lines.join('\n')}`); toast('Förslagen är kopierade'); }
    catch { toast('Kunde inte kopiera'); }
  };

  const meta = (f: Item) => [memberName(f.created_by), shortDate(f.created_at), f.done_at ? `fixat ${shortDate(f.done_at)}` : null].filter(Boolean).join(' · ');

  const row = (f: Item) => (
    <div key={f.id} className="row" style={{ alignItems: 'flex-start', gap: 12, padding: '14px 14px 14px 16px', borderRadius: 22, background: 'var(--color-surface)', opacity: f.done_at ? 0.65 : 1 }}>
      <div className="col" style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <span style={{ fontSize: 15, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', textDecoration: f.done_at ? 'line-through' : undefined }}>{f.text}</span>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{meta(f)}</span>
      </div>
      {f.done_at ? (
        <div className="row" style={{ flex: 'none', gap: 2 }}>
          <button className="hover-n300" onClick={() => run(setFeedbackDone(f.id, false))} aria-label="Markera som inte fixat"
            style={{ width: 36, height: 36, border: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', color: 'var(--color-neutral-700)', display: 'grid', placeItems: 'center' }}>
            <Ico icon={RotateCcw} size={16} />
          </button>
          <button className="hover-n300" onClick={() => { if (confirm('Ta bort förslaget?')) run(removeFeedback(f.id)); }} aria-label="Ta bort"
            style={{ width: 36, height: 36, border: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', color: 'var(--color-neutral-700)', display: 'grid', placeItems: 'center' }}>
            <Ico icon={Trash2} size={16} />
          </button>
        </div>
      ) : (
        <button className="btn btn-secondary" onClick={() => run(setFeedbackDone(f.id, true), 'Markerat som fixat')}
          style={{ flex: 'none', height: 38, padding: '0 12px', fontSize: 13, gap: 6 }}>
          <Ico icon={Check} size={15} />Fixat
        </button>
      )}
    </div>
  );

  return (
    <div className="screen narrow">
      <span className="kicker">{open.length} {open.length === 1 ? 'öppet förslag' : 'öppna förslag'}</span>
      <h1 className="h1" style={{ margin: '2px 0 6px' }}>Feedback</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--color-neutral-700)', fontSize: 14 }}>Skriv vad som borde ändras eller läggas till i appen. Alla i köket ser förslagen.</p>

      <div className="col" style={{ gap: 8, marginBottom: 22 }}>
        <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3}
          placeholder="t.ex. Jag vill kunna sortera recepten efter tid" style={{ resize: 'vertical', minHeight: 90, padding: '12px 14px', font: '400 15px var(--font-body)' }} />
        <button className="btn btn-primary" onClick={send} disabled={busy || !text.trim()} style={{ alignSelf: 'flex-start', height: 46, padding: '0 18px' }}>Skicka förslag</button>
      </div>

      <div className="col" style={{ gap: 8 }}>
        {open.length === 0 && <p className="muted" style={{ margin: 0 }}>Inga öppna förslag.</p>}
        {open.map(row)}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        {open.length > 0 && <button className="btn btn-ghost" onClick={copy} style={{ height: 40 }}><Ico icon={Copy} size={15} style={{ marginRight: 6 }} />Kopiera öppna förslag</button>}
        {done.length > 0 && <button className="btn btn-ghost" onClick={() => setShowDone((x) => !x)} style={{ height: 40 }}>{showDone ? 'Dölj fixade' : `Visa fixade (${done.length})`}</button>}
      </div>
      {showDone && <div className="col" style={{ gap: 8, marginTop: 8 }}>{done.map(row)}</div>}
    </div>
  );
}
