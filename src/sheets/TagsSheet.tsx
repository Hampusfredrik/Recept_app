import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { Ico, Sheet, useToast } from '../components/ui';
import { TONES } from '../lib/format';

/** Alla taggar: lägg till, byt färg, ta bort (bara taggar som inget recept har). */
export function TagsSheet({ onClose, onPick }: { onClose: () => void; onPick: (tagId: string) => void }) {
  const { tags, recipes, addTag, cycleTagTone, deleteTag } = useStore();
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

  const remove = async (id: string, name: string) => {
    try { await deleteTag(id); toast(`Taggen ${name} är borttagen`); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Sheet onClose={onClose} style={{ gap: 12, maxHeight: 'min(680px, calc(100dvh - 40px))', overflow: 'hidden' }}>
      <h3>Taggar</h3>
      <div className="col" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" value={v} onChange={(e) => { setV(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Ny tagg, t.ex. Vardag" maxLength={40} enterKeyHint="done" style={{ height: 48, fontSize: 16 }} />
          <button className="btn btn-primary" onClick={add} disabled={!v.trim()} style={{ flex: 'none', height: 48, padding: '0 16px' }}><Ico icon={Plus} size={16} />Lägg till</button>
        </div>
        {err && <span className="err">{err}</span>}
      </div>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Tryck på färgen för att byta. Tryck på namnet för att se taggens recept. En tagg kan bara tas bort när inget recept har den.</span>
      <div className="col" style={{ overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
        {tags.length === 0 && <span className="muted" style={{ padding: '8px 0' }}>Inga taggar än.</span>}
        {tags.map((t) => {
          const n = recipes.filter((r) => r.tagIds.includes(t.id)).length;
          const tn = TONES[t.tone];
          return (
            <div key={t.id} className="row" style={{ gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <button onClick={() => cycleTagTone(t.id)} aria-label={`Byt färg på ${t.name}`} style={{ flex: 'none', width: 36, height: 36, borderRadius: '50%', border: 0, cursor: 'pointer', background: tn.bg, display: 'grid', placeItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: tn.dot }} />
              </button>
              <button onClick={() => { onPick(t.id); onClose(); }} className="col"
                style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)', font: 'inherit' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>{t.name}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{n === 0 ? 'Inga recept' : n === 1 ? '1 recept' : `${n} recept`}</span>
              </button>
              <button className="hover-surface" disabled={n > 0} onClick={() => remove(t.id, t.name)}
                aria-label={n > 0 ? `${t.name} används i ${n} recept och kan inte tas bort` : `Ta bort ${t.name}`}
                title={n > 0 ? 'Används i recept. Ta bort taggen från recepten först.' : 'Ta bort'}
                style={{ flex: 'none', width: 40, height: 40, border: 0, borderRadius: 999, background: 'transparent', cursor: n > 0 ? 'not-allowed' : 'pointer', color: 'var(--color-neutral-600)', opacity: n > 0 ? 0.3 : 1, display: 'grid', placeItems: 'center' }}>
                <Ico icon={Trash2} />
              </button>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
