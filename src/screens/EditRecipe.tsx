import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { EffortField, Ico, Spinner, TagChooser, TopBar, useToast } from '../components/ui';
import { BookSuggestions } from '../components/SaveFields';
import { useBack } from '../components/useBack';
import { amountLabel } from '../lib/format';
import { toggle } from '../lib/logic';
import { parseIngredientLine } from '../../supabase/functions/_shared/parse';

// Inte ritad i designen; följer formspråket från "Bara bok och sida".
export function EditRecipe() {
  const { id } = useParams();
  const { recipes, tags, editRecipe } = useStore();
  const r = recipes.find((x) => x.id === id);
  const back = useBack(`/recept/${id}`);
  const nav = useNavigate();
  const toast = useToast();

  const [name, setName] = useState(r?.name ?? '');
  const [portions, setPortions] = useState(String(r?.portions ?? 4));
  const [effort, setEffort] = useState(r?.effort ?? 0);
  const [tagIds, setTagIds] = useState<string[]>(r?.tagIds ?? []);
  const [book, setBook] = useState(r?.book_title ?? '');
  const [page, setPage] = useState(r?.page ?? '');
  const [ingr, setIngr] = useState(r ? r.ingredients.map((i) => [amountLabel(i.amount, i.unit), i.name].filter(Boolean).join(' ')).join('\n') : '');
  const [steps, setSteps] = useState<string[]>(r ? r.steps.map((s) => s.text) : []);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  if (!r) return <Navigate to="/recept" replace />;

  const setStep = (k: number, v: string) => setSteps((s) => s.map((x, j) => (j === k ? v : x)));
  const move = (k: number, d: -1 | 1) => setSteps((s) => {
    const t = [...s]; const j = k + d;
    if (j < 0 || j >= t.length) return s;
    [t[k], t[j]] = [t[j], t[k]];
    return t;
  });

  const save = async () => {
    if (!name.trim()) return setErr('Receptet behöver ett namn.');
    if (r.source_type === 'book' && !book.trim()) return setErr('Fyll i vilken bok receptet står i.');
    const p = parseInt(portions, 10);
    setSaving(true); setErr('');
    try {
      await editRecipe(r.id, {
        fields: {
          name: name.trim(), effort, portions: Number.isFinite(p) && p > 0 ? Math.min(p, 100) : r.portions,
          ...(r.source_type === 'book' ? { book_title: book.trim(), page: page || null } : {}),
        },
        ingredients: ingr.split('\n').map((x) => x.trim()).filter(Boolean).map(parseIngredientLine),
        steps: steps.map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean),
        tagIds,
      });
      toast('Receptet är uppdaterat');
      nav(`/recept/${r.id}`, { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const smallBtn = { width: 36, height: 36, border: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--color-neutral-700)', flex: 'none' } as const;

  return (
    <div className="screen no-tabs narrow">
      <TopBar onClose={back} title="Redigera recept" />
      <div className="col" style={{ gap: 16 }}>
        <div className="field"><label>Namn</label>
          <input className="input big" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} placeholder="Skriv receptets namn" />
        </div>
        {r.source_type === 'book' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10 }}>
              <div className="field"><label>Bok</label><input className="input big" value={book} onChange={(e) => { setBook(e.target.value); setErr(''); }} placeholder="Bokens titel" /></div>
              <div className="field"><label>Sida</label><input className="input big" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" style={{ textAlign: 'center' }} /></div>
            </div>
            <BookSuggestions onPick={setBook} />
          </>
        )}
        <div className="field" style={{ maxWidth: 160 }}><label>Portioner</label>
          <input className="input big" value={portions} onChange={(e) => setPortions(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" style={{ textAlign: 'center' }} />
        </div>
        <EffortField value={effort} onChange={setEffort} error={false} />
        <TagChooser tags={tags} selected={tagIds} onToggle={(t) => setTagIds((x) => toggle(x, t))} />

        <div className="field"><label>Ingredienser · en per rad</label>
          <textarea className="input" value={ingr} onChange={(e) => setIngr(e.target.value)} placeholder={'400 g kycklingfilé\n1 gul lök'}
            style={{ borderRadius: 24, minHeight: 160, padding: '12px 16px', fontSize: 16, lineHeight: 1.5 }} />
        </div>

        <div className="col" style={{ gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Gör så här</span>
          {steps.map((text, k) => (
            <div key={k} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span style={{ flex: 'none', width: 32, height: 32, marginTop: 8, borderRadius: '50%', background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontSize: 15 }}>{k + 1}</span>
              <textarea className="input" value={text} onChange={(e) => setStep(k, e.target.value)} rows={Math.max(2, Math.ceil(text.length / 38))}
                style={{ flex: 1, borderRadius: 20, minHeight: 0, padding: '10px 14px', fontSize: 16, lineHeight: 1.45 }} />
              <div className="col" style={{ flex: 'none' }}>
                <button style={smallBtn} className="hover-surface" onClick={() => move(k, -1)} disabled={k === 0} aria-label="Flytta upp"><Ico icon={ArrowUp} size={16} /></button>
                <button style={smallBtn} className="hover-surface" onClick={() => move(k, 1)} disabled={k === steps.length - 1} aria-label="Flytta ner"><Ico icon={ArrowDown} size={16} /></button>
                <button style={smallBtn} className="hover-surface" onClick={() => setSteps((s) => s.filter((_, j) => j !== k))} aria-label="Ta bort steg"><Ico icon={Trash2} size={16} /></button>
              </div>
            </div>
          ))}
          <button onClick={() => setSteps((s) => [...s, ''])} className="row hover-surface"
            style={{ gap: 8, height: 48, padding: '0 16px', borderRadius: 22, border: '1.5px dashed var(--color-neutral-400)', background: 'transparent', cursor: 'pointer', font: '600 14px var(--font-body)', color: 'var(--color-neutral-700)' }}>
            <Ico icon={Plus} size={16} />Lägg till steg
          </button>
        </div>

        {err && <span className="err">{err}</span>}
        <button className="btn btn-primary btn-block" disabled={saving} onClick={save} style={{ height: 54, fontSize: 17 }}>{saving ? <Spinner /> : 'Spara ändringar'}</button>
      </div>
    </div>
  );
}
