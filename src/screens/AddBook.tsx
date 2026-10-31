import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Spinner, TopBar, useToast } from '../components/ui';
import { BookSuggestions, useSaveFields } from '../components/SaveFields';
import { useBack } from '../components/useBack';
import { parseIngredientLine } from '../../supabase/functions/_shared/parse';

export function AddBook() {
  const nav = useNavigate();
  const back = useBack();
  const toast = useToast();
  const { saveRecipe } = useStore();
  const [name, setName] = useState('');
  const [book, setBook] = useState('');
  const [page, setPage] = useState('');
  const [ingr, setIngr] = useState('');
  const [err, setErr] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saving, setSaving] = useState(false);
  const { effort, tagIds, fields, check } = useSaveFields();
  const border = (v: string) => (err && !v.trim() ? 'var(--color-accent)' : 'var(--color-divider)');

  const save = async () => {
    if (!name.trim() || !book.trim()) return setErr(true);
    if (!check()) return;
    setSaving(true);
    try {
      const id = await saveRecipe({
        name: name.trim(), effort, portions: 4, source_type: 'book', book_title: book.trim(), page: page || null,
        ingredients: ingr.split('\n').map((x) => x.trim()).filter(Boolean).map(parseIngredientLine), steps: [], tagIds,
      });
      nav(`/recept/${id}`, { replace: true });
      toast('Receptet är sparat');
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="screen no-tabs narrow">
      <TopBar onClose={back} title="Från kokbok" />
      <h1 style={{ margin: '0 0 20px', fontSize: 34 }}>Ett recept ur bokhyllan</h1>
      <div className="col" style={{ gap: 16 }}>
        <div className="field"><label>Namn på receptet</label>
          <input className="input big" value={name} onChange={(e) => { setName(e.target.value); setErr(false); }} placeholder="t.ex. Kycklinggryta" style={{ borderColor: border(name) }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10 }}>
          <div className="field"><label>Bok</label>
            <input className="input big" value={book} onChange={(e) => { setBook(e.target.value); setErr(false); }} placeholder="Bokens titel" style={{ borderColor: border(book) }} />
          </div>
          <div className="field"><label>Sida</label>
            <input className="input big" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="123" style={{ textAlign: 'center' }} />
          </div>
        </div>
        <BookSuggestions onPick={(b) => { setBook(b); setErr(false); }} />
        {err && <div className="err">Fyll i receptets namn och vilken bok det står i.</div>}
        {fields}
        <div className="field"><label>Ingredienser (valfritt) · en per rad, ger näringsvärde</label>
          <textarea className="input" value={ingr} onChange={(e) => setIngr(e.target.value)} placeholder={'400 g kycklingfilé\n1 gul lök\n4 dl kokosmjölk'}
            style={{ borderRadius: 24, minHeight: 110, padding: '12px 16px', fontSize: 16 }} />
        </div>
        {saveErr && <span className="err">{saveErr}</span>}
        <button className="btn btn-primary btn-block" disabled={saving} onClick={save} style={{ height: 54, fontSize: 17 }}>{saving ? <Spinner /> : 'Spara recept'}</button>
      </div>
    </div>
  );
}
