import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { Ico, TopBar } from '../components/ui';
import { useBack } from '../components/useBack';
import { pantryResults, pantrySuggestions } from '../lib/logic';

export function Pantry() {
  const { recipes, pantry, addPantry, removePantry } = useStore();
  const nav = useNavigate();
  const [v, setV] = useState('');
  const back = useBack('/');
  const add = (raw: string) => {
    const s = raw.trim().toLowerCase();
    setV('');
    if (s && !pantry.map((p) => p.toLowerCase()).includes(s)) addPantry(s);
  };
  const results = pantryResults(recipes, pantry);
  const suggest = pantrySuggestions(recipes, pantry);

  return (
    <div className="screen no-tabs narrow" style={{ paddingBottom: 60 }}>
      <TopBar icon="back" onClose={back} />
      <h1 style={{ margin: '0 0 6px', fontSize: 34 }}>Vad kan jag laga?</h1>
      <p style={{ margin: '0 0 18px', color: 'var(--color-neutral-700)', fontSize: 14 }}>Lägg till det du har hemma. Recepten där minst fattas hamnar först.</p>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add(v)} placeholder="t.ex. kyckling" style={{ height: 48, fontSize: 15 }} />
        <button className="btn btn-primary" onClick={() => add(v)} aria-label="Lägg till" style={{ flex: 'none', width: 48, height: 48, padding: 0, borderRadius: '50%' }}><Ico icon={Plus} /></button>
      </div>
      <div className="wrap" style={{ marginTop: 12 }}>
        {pantry.map((p) => (
          <button key={p} onClick={() => removePantry(p)} className="row" style={{ gap: 6, height: 34, padding: '0 10px 0 14px', borderRadius: 999, border: 0, background: 'var(--color-accent-2-600)', color: 'var(--color-bg)', cursor: 'pointer', font: '600 14px var(--font-body)' }}>
            {p}<Ico icon={X} size={13} />
          </button>
        ))}
      </div>
      {suggest.length > 0 && (
        <div className="col" style={{ gap: 6, marginTop: 14 }}>
          <span className="label">Vanligt i dina recept</span>
          <div className="wrap">
            {suggest.map((k) => (
              <button key={k} className="hover-surface" onClick={() => add(k)} style={{ height: 32, padding: '0 12px', borderRadius: 999, border: '1.5px solid var(--color-divider)', background: 'transparent', cursor: 'pointer', font: '600 13px var(--font-body)', color: 'var(--color-text)' }}>+ {k}</button>
            ))}
          </div>
        </div>
      )}
      <div className="col" style={{ gap: 10, marginTop: 26 }}>
        <h3 style={{ margin: 0, fontSize: 22 }}>Förslag</h3>
        {results.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Inga recept med ingredienser än.</p>}
        {results.map(({ recipe: r, missing, total }) => {
          const all = missing.length === 0, close = missing.length <= 2;
          return (
            <div key={r.id} onClick={() => nav(`/recept/${r.id}`)} className="col" style={{ gap: 8, padding: '14px 16px', borderRadius: 26, background: 'var(--color-surface)', cursor: 'pointer' }}>
              <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 17, lineHeight: 1.15 }}>{r.name}</span>
                <span className="tag" style={{ flex: 'none', fontWeight: 700,
                  background: all ? 'var(--color-accent-2-600)' : close ? 'var(--color-accent-2-100)' : 'var(--color-neutral-200)',
                  color: all ? 'var(--color-bg)' : close ? 'var(--color-accent-2-800)' : 'var(--color-neutral-800)' }}>
                  {all ? 'Du har allt' : `Har ${total - missing.length} av ${total}`}
                </span>
              </div>
              <div className="bar"><div style={{ width: `${Math.round((total - missing.length) / total * 100)}%`, background: 'var(--color-accent-2-600)' }} /></div>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-800)' }}>
                {all ? 'Allt finns hemma.' : 'Saknas: ' + missing.slice(0, 4).join(', ') + (missing.length > 4 ? ` +${missing.length - 4}` : '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
