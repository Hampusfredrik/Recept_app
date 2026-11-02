import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { EffortField, Ico, Spinner, TagChooser, TopBar, useToast } from '../components/ui';
import { BookSuggestions } from '../components/SaveFields';
import { useBack } from '../components/useBack';
import { amountLabel } from '../lib/format';
import { toggle } from '../lib/logic';
import { parseIngredientLine, stepsFromText } from '../../supabase/functions/_shared/parse';
import type { Recipe } from '../lib/types';

// Inte ritad i designen; följer formspråket från "Bara bok och sida".
export function EditRecipe() {
  const { id } = useParams();
  const { recipes, tags, editRecipe, members, addTag } = useStore();
  const named = members.filter((m) => m.display_name);
  const r = recipes.find((x) => x.id === id);
  const back = useBack(`/recept/${id}`);
  const nav = useNavigate();
  const toast = useToast();

  const [name, setName] = useState(r?.name ?? '');
  const [portions, setPortions] = useState(String(r?.portions ?? 4));
  const [effort, setEffort] = useState(r?.effort ?? 0);
  const [tagIds, setTagIds] = useState<string[]>(r?.tagIds ?? []);
  const [author, setAuthor] = useState<string | null>(r?.created_by ?? null);
  const [book, setBook] = useState(r?.book_title ?? '');
  const [page, setPage] = useState(r?.page ?? '');
  // Delar i receptet: huvuddelen (utan namn) och t.ex. "Frosting", var och en med ingredienser och steg.
  const [parts, setParts] = useState<Part[]>(() => (r ? initialParts(r) : [{ name: '', ingr: '', steps: [], stepsText: '' }]));
  const setPart = (k: number, p: Partial<Part>) => setParts((ps) => ps.map((x, j) => (j === k ? { ...x, ...p } : x)));
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  if (!r) return <Navigate to="/recept" replace />;

  const setStep = (pk: number, k: number, v: string) => setPart(pk, { steps: parts[pk].steps.map((x, j) => (j === k ? v : x)) });
  const move = (pk: number, k: number, d: -1 | 1) => {
    const t = [...parts[pk].steps]; const j = k + d;
    if (j < 0 || j >= t.length) return;
    [t[k], t[j]] = [t[j], t[k]];
    setPart(pk, { steps: t });
  };

  const save = async () => {
    if (!name.trim()) return setErr('Receptet behöver ett namn.');
    if (parts.some((p, k) => k > 0 && !p.name.trim() && (p.ingr.trim() || p.stepsText.trim()))) return setErr('Ge varje del ett namn, t.ex. Frosting.');
    if (r.source_type === 'book' && !book.trim()) return setErr('Fyll i vilken bok receptet står i.');
    const p = parseInt(portions, 10);
    setSaving(true); setErr('');
    try {
      await editRecipe(r.id, {
        fields: {
          name: name.trim(), effort, portions: Number.isFinite(p) && p > 0 ? Math.min(p, 100) : r.portions,
          ...(r.source_type === 'book' ? { book_title: book.trim(), page: page || null } : {}),
          ...(author !== (r.created_by ?? null) ? { created_by: author } : {}),
        },
        ingredients: parts.flatMap((p) => p.ingr.split('\n').map((x) => x.trim()).filter(Boolean)
          .map((x) => ({ ...parseIngredientLine(x), section: p.name.trim() || null }))),
        steps: parts.flatMap((p, pk) => (pk > 0 ? stepsFromText(p.stepsText).map((x) => x.text) : p.steps.map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean))
          .map((text) => ({ text, section: p.name.trim() || null }))),
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
        <TagChooser tags={tags} selected={tagIds} onToggle={(t) => setTagIds((x) => toggle(x, t))} onCreate={async (n) => (await addTag(n)).id} />
        {named.length > 0 && (
          <div className="col" style={{ gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Inlagt av</span>
            <div className="wrap">
              {named.map((m) => (
                <button key={m.user_id} type="button" className={'chip' + (author === m.user_id ? ' on' : '')} onClick={() => setAuthor(author === m.user_id ? null : m.user_id)}>
                  {author === m.user_id ? '✓ ' : ''}{m.display_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {parts.map((p, pk) => (
          <div key={pk} className="col" style={{ gap: 14, ...(pk > 0 ? { padding: 14, borderRadius: 20, border: '1.5px solid var(--color-divider)' } : {}) }}>
            {pk > 0 && (
              <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: 1 }}><label>Delrecept</label>
                  <input className="input big" value={p.name} onChange={(e) => { setPart(pk, { name: e.target.value }); setErr(''); }} placeholder="t.ex. Frosting" />
                </div>
                <button style={{ ...smallBtn, width: 44, height: 44 }} className="hover-surface" aria-label={`Ta bort delen ${p.name}`}
                  onClick={() => { if ((!p.ingr.trim() && !p.stepsText.trim()) || confirm(`Ta bort delen ”${p.name || 'utan namn'}” med dess ingredienser och steg?`)) setParts((ps) => ps.filter((_, j) => j !== pk)); }}>
                  <Ico icon={Trash2} size={18} />
                </button>
              </div>
            )}
            <div className="field"><label>{pk > 0 && p.name.trim() ? `Ingredienser till ${p.name.trim().toLowerCase()}` : 'Ingredienser'} · en per rad</label>
              <textarea className="input" value={p.ingr} onChange={(e) => setPart(pk, { ingr: e.target.value })} placeholder={pk > 0 ? '200 g färskost\n1 dl florsocker' : '400 g kycklingfilé\n1 gul lök'}
                style={{ borderRadius: 24, minHeight: pk > 0 ? 110 : 160, padding: '12px 16px', fontSize: 16, lineHeight: 1.5 }} />
            </div>
            {pk > 0 ? (
              <div className="field"><label>{p.name.trim() ? `Gör så här · ${p.name.trim().toLowerCase()}` : 'Gör så här'} · alla steg</label>
                <textarea className="input" value={p.stepsText} onChange={(e) => setPart(pk, { stepsText: e.target.value })} placeholder={'1. Vispa smör och färskost.\n2. Sikta ner florsockret.'}
                  style={{ borderRadius: 24, minHeight: 130, padding: '12px 16px', fontSize: 16, lineHeight: 1.5 }} />
              </div>
            ) : (
            <div className="col" style={{ gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{pk > 0 && p.name.trim() ? `Gör så här · ${p.name.trim().toLowerCase()}` : 'Gör så här'}</span>
              {p.steps.map((text, k) => (
                <div key={k} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ flex: 'none', width: 32, height: 32, marginTop: 8, borderRadius: '50%', background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontSize: 15 }}>{k + 1}</span>
                  <textarea className="input" value={text} onChange={(e) => setStep(pk, k, e.target.value)} rows={Math.max(2, Math.ceil(text.length / 38))}
                    style={{ flex: 1, borderRadius: 20, minHeight: 0, padding: '10px 14px', fontSize: 16, lineHeight: 1.45 }} />
                  <div className="col" style={{ flex: 'none' }}>
                    <button style={smallBtn} className="hover-surface" onClick={() => move(pk, k, -1)} disabled={k === 0} aria-label="Flytta upp"><Ico icon={ArrowUp} size={16} /></button>
                    <button style={smallBtn} className="hover-surface" onClick={() => move(pk, k, 1)} disabled={k === p.steps.length - 1} aria-label="Flytta ner"><Ico icon={ArrowDown} size={16} /></button>
                    <button style={smallBtn} className="hover-surface" onClick={() => setPart(pk, { steps: p.steps.filter((_, j) => j !== k) })} aria-label="Ta bort steg"><Ico icon={Trash2} size={16} /></button>
                  </div>
                </div>
              ))}
              <button onClick={() => setPart(pk, { steps: [...p.steps, ''] })} className="row hover-surface"
                style={{ gap: 8, height: 48, padding: '0 16px', borderRadius: 22, border: '1.5px dashed var(--color-neutral-400)', background: 'transparent', cursor: 'pointer', font: '600 14px var(--font-body)', color: 'var(--color-neutral-700)' }}>
                <Ico icon={Plus} size={16} />Lägg till steg
              </button>
            </div>
            )}
          </div>
        ))}
        <button onClick={() => setParts((ps) => [...ps, { name: '', ingr: '', steps: [], stepsText: '' }])} className="btn btn-secondary" style={{ alignSelf: 'flex-start', height: 46, padding: '0 16px' }}>
          <Ico icon={Plus} size={16} style={{ marginRight: 6 }} />Lägg till delrecept, t.ex. frosting
        </button>

        {err && <span className="err">{err}</span>}
        <button className="btn btn-primary btn-block" disabled={saving} onClick={save} style={{ height: 54, fontSize: 17 }}>{saving ? <Spinner /> : 'Spara ändringar'}</button>
      </div>
    </div>
  );
}

/** steps används för huvuddelen (en ruta per steg), stepsText för delrecept (alla steg i en ruta). */
interface Part { name: string; ingr: string; steps: string[]; stepsText: string }

/** Receptets delar som redigerbara fält: huvuddelen först, sedan varje namngiven del. */
function initialParts(r: Recipe): Part[] {
  const line = (i: Recipe['ingredients'][number]) => [amountLabel(i.amount, i.unit, 1, i.amount_max), i.name].filter(Boolean).join(' ');
  const names = [...new Set([...r.ingredients, ...r.steps].map((x) => x.section?.trim() || '').filter(Boolean))];
  return ['', ...names].map((name) => {
    const steps = r.steps.filter((x) => (x.section?.trim() || '') === name).map((x) => x.text);
    return {
      name,
      ingr: r.ingredients.filter((i) => (i.section?.trim() || '') === name).map(line).join('\n'),
      steps,
      stepsText: steps.map((t, k) => `${k + 1}. ${t}`).join('\n'),
    };
  });
}
