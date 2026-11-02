import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Spinner, Stepper, TopBar, useToast } from '../components/ui';
import { BookSuggestions, useSaveFields } from '../components/SaveFields';
import { useBack } from '../components/useBack';
import { ingredientsFromText, stepsFromText } from '../../supabase/functions/_shared/parse';

/** Skriv in ett recept för hand. Bok och sida är valfria. */
export function AddBook() {
  const nav = useNavigate();
  const back = useBack();
  const toast = useToast();
  const { saveRecipe } = useStore();
  const [name, setName] = useState('');
  const [portions, setPortions] = useState(4);
  const [book, setBook] = useState('');
  const [page, setPage] = useState('');
  const [ingr, setIngr] = useState('');
  const [steps, setSteps] = useState('');
  const [err, setErr] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saving, setSaving] = useState(false);
  const { effort, tagIds, fields, check } = useSaveFields();

  const save = async () => {
    if (!name.trim()) return setErr(true);
    if (!check()) return;
    setSaving(true);
    try {
      const id = await saveRecipe({
        name: name.trim(), effort, portions, source_type: 'book', book_title: book.trim() || null, page: page || null,
        // Delrubriker som "Frosting:" blir delar av receptet.
        ingredients: ingredientsFromText(ingr), steps: stepsFromText(steps), tagIds,
      });
      nav(`/recept/${id}`, { replace: true });
      toast('Receptet är sparat');
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const box = { borderRadius: 24, minHeight: 130, padding: '12px 16px', fontSize: 16, lineHeight: 1.5 } as const;

  return (
    <div className="screen no-tabs narrow">
      <TopBar onClose={back} title="Skriv in recept" />
      <h1 style={{ margin: '0 0 20px', fontSize: 34 }}>Skriv in ett recept</h1>
      <div className="col" style={{ gap: 16 }}>
        <div className="field"><label>Namn på receptet</label>
          <input className="input big" value={name} onChange={(e) => { setName(e.target.value); setErr(false); }} placeholder="t.ex. Kycklinggryta"
            style={{ borderColor: err && !name.trim() ? 'var(--color-accent)' : 'var(--color-divider)' }} />
          {err && <div className="err" style={{ marginTop: 6 }}>Receptet behöver ett namn.</div>}
        </div>
        <Stepper label="Antal portioner" value={portions} onChange={setPortions} />
        {fields}
        <div className="field"><label>Ingredienser · en per rad</label>
          <textarea className="input" value={ingr} onChange={(e) => setIngr(e.target.value)} placeholder={'400 g kycklingfilé\n1 gul lök\n4 dl kokosmjölk'} style={box} />
        </div>
        <div className="field"><label>Gör så här · alla steg</label>
          <textarea className="input" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={'1. Skär kycklingen i bitar.\n2. Fräs löken.'} style={box} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10 }}>
          <div className="field"><label>Bok (valfritt)</label>
            <input className="input big" value={book} onChange={(e) => setBook(e.target.value)} placeholder="Bokens titel" />
          </div>
          <div className="field"><label>Sida</label>
            <input className="input big" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="123" style={{ textAlign: 'center' }} />
          </div>
        </div>
        <BookSuggestions onPick={setBook} />
        {saveErr && <span className="err">{saveErr}</span>}
        <button className="btn btn-primary btn-block" disabled={saving} onClick={save} style={{ height: 54, fontSize: 17 }}>{saving ? <Spinner /> : 'Spara recept'}</button>
      </div>
    </div>
  );
}
