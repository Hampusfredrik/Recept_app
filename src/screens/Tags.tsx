import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUi } from '../components/uiState';
import { Ico, useToast } from '../components/ui';
import { emptyFilter } from '../lib/logic';
import { TONES } from '../lib/format';

export function Tags() {
  const { tags, recipes, addTag, cycleTagTone, deleteTag } = useStore();
  const { setFilter } = useUi();
  const nav = useNavigate();
  const toast = useToast();
  const [v, setV] = useState('');
  const [err, setErr] = useState('');

  const add = async () => {
    const s = v.trim();
    if (!s) return setErr('Skriv ett namn på taggen.');
    if (tags.some((t) => t.name.toLowerCase() === s.toLowerCase())) return setErr(`Taggen ”${s}” finns redan.`);
    const name = s[0].toUpperCase() + s.slice(1);
    try {
      await addTag(name);
      setV(''); setErr('');
      toast(`Taggen ${name} har lagts till`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="screen narrow">
      <span className="kicker">{tags.length} st</span>
      <h1 className="h1" style={{ margin: '2px 0 6px' }}>Taggar</h1>
      <p style={{ margin: '0 0 18px', color: 'var(--color-neutral-700)', fontSize: 14 }}>Tryck på färgen för att byta. Tryck på en tagg för att se dess recept.</p>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <input className="input" value={v} onChange={(e) => { setV(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Ny tagg, t.ex. Vardag" style={{ height: 48, fontSize: 15 }} />
        <button className="btn btn-primary" onClick={add} style={{ flex: 'none', height: 48, padding: '0 18px', borderRadius: 999 }}><Ico icon={Plus} size={16} />Lägg till</button>
      </div>
      {err && <div className="err" style={{ margin: '0 0 6px 16px' }}>{err}</div>}
      <div className="col" style={{ marginTop: 14 }}>
        {tags.map((t) => {
          const n = recipes.filter((r) => r.tagIds.includes(t.id)).length;
          const tn = TONES[t.tone];
          return (
            <div key={t.id} className="row" style={{ gap: 14, padding: '12px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <button onClick={() => cycleTagTone(t.id)} aria-label="Byt färg" style={{ flex: 'none', width: 36, height: 36, borderRadius: '50%', border: 0, cursor: 'pointer', background: tn.bg, display: 'grid', placeItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: tn.dot }} />
              </button>
              <div onClick={() => { setFilter({ ...emptyFilter, chip: t.id }); nav('/recept'); }} className="col" style={{ flex: 1, cursor: 'pointer' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{t.name}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{n} recept</span>
              </div>
              <button className="hover-surface" onClick={() => { if (confirm(`Ta bort taggen ”${t.name}”?`)) deleteTag(t.id); }} aria-label="Ta bort"
                style={{ flex: 'none', width: 40, height: 40, border: 0, borderRadius: 999, background: 'transparent', cursor: 'pointer', color: 'var(--color-neutral-600)', display: 'grid', placeItems: 'center' }}>
                <Ico icon={Trash2} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
