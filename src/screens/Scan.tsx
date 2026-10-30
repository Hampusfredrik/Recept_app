import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { useStore } from '../lib/store';
import { Ico, Spinner, TopBar, useToast } from '../components/ui';
import { BookSuggestions, useSaveFields } from '../components/SaveFields';
import { useBack } from '../components/useBack';
import { parseIngredientLine, parseRaw, type LineKind, type RawLine } from '../../supabase/functions/_shared/parse';

const KIND_CYCLE: LineKind[] = ['ingr', 'step', 'skip'];
const KIND_META: Record<LineKind, { label: string; pillBg: string; pillFg: string; bg: string; border: string }> = {
  ingr: { label: 'Ingrediens', pillBg: 'var(--color-accent-2-200)', pillFg: 'var(--color-accent-2-900)', bg: 'var(--color-accent-2-100)', border: 'transparent' },
  step: { label: 'Steg', pillBg: 'var(--color-accent-200)', pillFg: 'var(--color-accent-900)', bg: 'var(--color-accent-100)', border: 'transparent' },
  skip: { label: 'Ignoreras', pillBg: 'var(--color-neutral-200)', pillFg: 'var(--color-neutral-700)', bg: 'transparent', border: 'var(--color-divider)' },
};
const PASTE_STEPS = ['Öppna Kamera och rikta den mot receptet.', 'Tryck på textikonen nere till höger och välj Kopiera allt.', 'Kom tillbaka hit och klistra in.'];

type Phase = 'paste' | 'camera' | 'reading' | 'sort';

export function Scan() {
  const nav = useNavigate();
  const back = useBack();
  const toast = useToast();
  const { saveRecipe } = useStore();
  const [phase, setPhase] = useState<Phase>('paste');
  const [raw, setRaw] = useState('');
  const [clips, setClips] = useState(0);
  const [name, setName] = useState('');
  const [book, setBook] = useState('');
  const [page, setPage] = useState('');
  const [pageFound, setPageFound] = useState(false);
  const [portions, setPortions] = useState(4);
  const [lines, setLines] = useState<RawLine[]>([]);
  const [bookErr, setBookErr] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const { effort, tagIds, fields, check } = useSaveFields();

  const append = (t: string) => { setRaw((r) => (r.trim() ? r.trim() + '\n' : '') + t.trim()); setClips((c) => c + 1); };

  const pasteClip = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) append(t);
    } catch {
      // Ingen åtkomst till urklipp: låt användaren klistra in själv.
      areaRef.current?.focus();
    }
  };

  const sort = (text: string) => {
    if (!text.trim()) return;
    const p = parseRaw(text);
    setName(p.name || 'Namnlöst recept');
    setLines(p.lines);
    setPage(p.page);
    setPageFound(!!p.page);
    setPortions(p.portions ?? 4);
    setPhase('sort');
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhase('reading'); setErr('');
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('swe');
      const { data } = await worker.recognize(file);
      await worker.terminate();
      setRaw(data.text);
      sort(data.text);
    } catch (e) {
      setErr('Kunde inte läsa texten: ' + (e instanceof Error ? e.message : String(e)));
      setPhase('paste');
    }
  };

  const save = async () => {
    if (!book.trim()) return setBookErr(true);
    if (!check()) return;
    setSaving(true);
    try {
      const id = await saveRecipe({
        name: name.trim() || 'Namnlöst recept', effort, portions, source_type: 'book', book_title: book.trim(), page: page || null,
        ingredients: lines.filter((l) => l.kind === 'ingr').map((l) => parseIngredientLine(l.text)),
        steps: lines.filter((l) => l.kind === 'step').map((l) => l.text), tagIds,
      });
      nav(`/recept/${id}`, { replace: true });
      toast('Receptet är sparat');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const nI = lines.filter((l) => l.kind === 'ingr').length;
  const nS = lines.filter((l) => l.kind === 'step').length;
  const fileInput = <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />;

  if (phase === 'camera') {
    const corner = (pos: React.CSSProperties, r: string) => (
      <div style={{ position: 'absolute', width: 38, height: 38, borderColor: 'var(--color-accent-300)', borderStyle: 'solid', borderWidth: 0, borderRadius: r, ...pos }} />
    );
    return (
      <div className="col" style={{ position: 'fixed', inset: 0, left: 'var(--edge)', right: 'var(--edge)', background: 'var(--color-neutral-900)', color: 'var(--color-neutral-100)', padding: 'var(--top-pad) 20px 40px', zIndex: 6 }}>
        {fileInput}
        <TopBar dark onClose={() => setPhase('paste')} title="Fota kokbokssida" />
        <div style={{ position: 'relative', flex: 1, margin: '0 0 18px', borderRadius: 34, overflow: 'hidden', background: 'repeating-linear-gradient(135deg,var(--color-neutral-800) 0 10px,var(--color-neutral-900) 10px 20px)', display: 'grid', placeItems: 'center' }}>
          {corner({ top: 22, left: 22, borderTopWidth: 4, borderLeftWidth: 4 }, '18px 0 0 0')}
          {corner({ top: 22, right: 22, borderTopWidth: 4, borderRightWidth: 4 }, '0 18px 0 0')}
          {corner({ bottom: 22, left: 22, borderBottomWidth: 4, borderLeftWidth: 4 }, '0 0 0 18px')}
          {corner({ bottom: 22, right: 22, borderBottomWidth: 4, borderRightWidth: 4 }, '0 0 18px 0')}
          <span style={{ position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)', padding: '7px 14px', borderRadius: 999, background: 'var(--color-neutral-900)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Håll sidan plant och i bra ljus</span>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button onClick={() => fileRef.current?.click()} aria-label="Ta bild" style={{ width: 78, height: 78, borderRadius: '50%', border: '4px solid var(--color-neutral-100)', background: 'transparent', padding: 5, cursor: 'pointer' }}>
            <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', background: 'var(--color-neutral-100)' }} />
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'reading') {
    return (
      <div className="col" style={{ minHeight: '100dvh', alignItems: 'flex-start', justifyContent: 'center', gap: 12, padding: '0 28px' }}>
        <Spinner size={28} border={4} />
        <h2 style={{ margin: 0, fontSize: 28 }}>Läser texten…</h2>
        <p style={{ margin: 0, color: 'var(--color-neutral-700)' }}>Texten tolkas i telefonen. Första gången laddas den svenska språkmodellen ner.</p>
      </div>
    );
  }

  if (phase === 'sort') {
    return (
      <div className="screen no-tabs">
        <TopBar icon="back" onClose={() => setPhase('paste')} title="Från kokbok" />
        <div className="col" style={{ gap: 18 }}>
          <div className="col" style={{ gap: 4 }}>
            <span style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-accent-2-700)', fontWeight: 700 }}>{lines.length} rader hittades</span>
            <h1 style={{ margin: 0, fontSize: 30 }}>Sortera texten</h1>
            <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>Vi har gissat vad som är ingredienser och steg. Tryck på en rad för att ändra.</p>
          </div>
          <div className="field"><label>Namn</label><input className="input big" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10 }}>
            <div className="field"><label>Bok</label>
              <input className="input big" value={book} onChange={(e) => { setBook(e.target.value); setBookErr(false); }} placeholder="Bokens titel" style={{ borderColor: bookErr ? 'var(--color-accent)' : 'var(--color-divider)' }} />
            </div>
            <div className="field"><label>Sida</label>
              <input className="input big" value={page} onChange={(e) => { setPage(e.target.value.replace(/\D/g, '').slice(0, 4)); setPageFound(false); }} inputMode="numeric" style={{ textAlign: 'center' }} />
            </div>
          </div>
          <BookSuggestions onPick={(b) => { setBook(b); setBookErr(false); }} />
          {bookErr && <span className="err" style={{ marginTop: -8 }}>Fyll i vilken bok receptet står i.</span>}
          {pageFound && <span style={{ fontSize: 12, color: 'var(--color-accent-2-700)', marginTop: -8, fontWeight: 600 }}>Sidnumret hittades nederst på sidan.</span>}
          <div className="row" style={{ gap: 8 }}>
            {[[`${nI} ingredienser`, KIND_META.ingr], [`${nS} steg`, KIND_META.step]].map(([label, m]) => {
              const meta = m as typeof KIND_META.ingr;
              return <span key={label as string} className="tag" style={{ background: meta.pillBg, color: meta.pillFg, fontWeight: 700, fontSize: 12, padding: '4px 10px' }}>{label as string}</span>;
            })}
          </div>
          <div className="col" style={{ gap: 6, marginTop: -6 }}>
            {lines.map((l, i) => {
              const m = KIND_META[l.kind];
              return (
                <button key={i} onClick={() => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, kind: KIND_CYCLE[(KIND_CYCLE.indexOf(x.kind) + 1) % 3] } : x)))}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 20, border: `1.5px solid ${m.border}`, background: m.bg, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
                  <span style={{ flex: 'none', width: 82, padding: '2px 0', borderRadius: 999, background: m.pillBg, color: m.pillFg, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>{m.label}</span>
                  <span style={{ flex: 1, fontSize: 14, lineHeight: 1.35, textDecoration: l.kind === 'skip' ? 'line-through' : 'none', color: l.kind === 'skip' ? 'var(--color-neutral-600)' : 'var(--color-text)' }}>{l.text}</span>
                </button>
              );
            })}
          </div>
          {fields}
          {err && <span className="err">{err}</span>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setPhase('paste')} style={{ height: 54, flex: 'none', padding: '0 18px', fontSize: 16 }}>Fota igen</button>
            <button className="btn btn-primary" disabled={saving} onClick={save} style={{ height: 54, flex: 1, fontSize: 17 }}>{saving ? <Spinner /> : 'Spara recept'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen no-tabs" style={{ paddingBottom: 60 }}>
      <TopBar onClose={back} title="Från kokbok" />
      <h1 style={{ margin: '0 0 16px', fontSize: 32 }}>Kopiera texten med kameran</h1>
      <div className="col" style={{ gap: 10, marginBottom: 20 }}>
        {PASTE_STEPS.map((t, i) => (
          <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{i + 1}</span>
            <span style={{ fontSize: 15, paddingTop: 3, textWrap: 'pretty' }}>{t}</span>
          </div>
        ))}
      </div>
      <div className="col" style={{ gap: 8 }}>
        <textarea ref={areaRef} className="input" value={raw} onChange={(e) => { setRaw(e.target.value); if (!clips && e.target.value) setClips(1); }} placeholder="Klistra in texten här"
          style={{ borderRadius: 26, minHeight: 200, padding: '14px 16px', fontSize: 16, lineHeight: 1.45 }} />
        <div className="wrap" style={{ gap: 8 }}>
          <button onClick={pasteClip} className="row" style={{ gap: 6, height: 40, padding: '0 16px', borderRadius: 999, border: 0, background: 'var(--color-text)', color: 'var(--color-bg)', cursor: 'pointer', font: '700 14px var(--font-body)' }}>
            {clips === 0 ? 'Klistra in' : 'Klistra in en spalt till'}
          </button>
          {raw.trim() && <button onClick={() => { setRaw(''); setClips(0); }} style={{ height: 40, padding: '0 14px', borderRadius: 999, border: '1.5px solid var(--color-divider)', background: 'transparent', cursor: 'pointer', font: '600 14px var(--font-body)', color: 'var(--color-text)' }}>Rensa</button>}
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Två spalter? Kopiera en i taget och klistra in båda. Texten läggs till efter den förra.</span>
      </div>
      {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
      <button className="btn btn-primary btn-block" onClick={() => sort(raw)} disabled={!raw.trim()} style={{ height: 54, marginTop: 22, fontSize: 17 }}>Sortera texten</button>
      <button onClick={() => setPhase('camera')} className="row" style={{ justifyContent: 'center', gap: 8, width: '100%', height: 44, marginTop: 8, border: 0, background: 'transparent', cursor: 'pointer', font: '600 14px var(--font-body)', color: 'var(--color-accent-700)' }}>
        <Ico icon={Camera} size={16} />Fota i appen istället (sämre på svår text)
      </button>
    </div>
  );
}
