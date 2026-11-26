import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { useStore } from '../lib/store';
import { Ico, Spinner, Stepper, TopBar, useToast } from '../components/ui';
import { BookSuggestions, useSaveFields } from '../components/SaveFields';
import { useBack } from '../components/useBack';
import { ingredientsFromText, stepsFromText } from '../../supabase/functions/_shared/parse';

const PASTE_STEPS = ['Öppna Kamera och rikta den mot ingredienserna (eller stegen).', 'Tryck på textikonen nere till höger och välj Kopiera allt.', 'Kom tillbaka hit och klistra in i rätt ruta.'];

type Box = 'ingr' | 'steps';
type Phase = 'form' | 'camera' | 'reading';

// ── Utkast ──
// En app på iPhones hemskärm stängs ofta när man växlar till Kameran för Live Text.
// Utkastet sparas därför på telefonen och läses tillbaka när appen startar igen.
const DRAFT_KEY = 'receptappen.scanDraft';
interface Draft { name: string; book: string; page: string; portions: number; ingr: string; steps: string; savedAt: number; raw?: string }
function loadDraft(maxMinutes = 12 * 60): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    if (!d || Date.now() - d.savedAt >= maxMinutes * 60_000) return null;
    // Äldre utkast hade all text i en ruta.
    return { name: d.name ?? '', book: d.book ?? '', page: d.page ?? '', portions: d.portions ?? 4, ingr: d.ingr ?? d.raw ?? '', steps: d.steps ?? '', savedAt: d.savedAt };
  } catch { return null; }
}
export const hasFreshScanDraft = (minutes: number) => !!loadDraft(minutes);
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignoreras */ } };

const STATUS: Record<string, string> = {
  'loading tesseract core': 'Laddar textläsaren',
  'initializing tesseract': 'Startar textläsaren',
  'loading language traineddata': 'Laddar svenska språket',
  'initializing api': 'Förbereder',
  'recognizing text': 'Läser texten',
};

export function Scan() {
  const nav = useNavigate();
  const back = useBack();
  const toast = useToast();
  const { saveRecipe, takeSaveWarning } = useStore();
  const [draft] = useState(() => loadDraft());
  const [phase, setPhase] = useState<Phase>('form');
  const [target, setTarget] = useState<Box>('ingr');
  const [name, setName] = useState(draft?.name === 'Namnlöst recept' ? '' : draft?.name ?? '');
  const [book, setBook] = useState(draft?.book ?? '');
  const [page, setPage] = useState(draft?.page ?? '');
  const [portions, setPortions] = useState(draft?.portions ?? 4);
  const [ingr, setIngr] = useState(draft?.ingr ?? '');
  const [steps, setSteps] = useState(draft?.steps ?? '');
  const [progress, setProgress] = useState<{ status: string; pct: number } | null>(null);
  const [nameErr, setNameErr] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { effort, tagIds, fields, check } = useSaveFields();

  // Spara utkastet vid varje ändring.
  useEffect(() => {
    try {
      if (!ingr.trim() && !steps.trim() && !name.trim()) { clearDraft(); return; }
      const d: Draft = { name, book, page, portions, ingr, steps, savedAt: Date.now() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch { /* utan lagring fungerar sidan ändå */ }
  }, [name, book, page, portions, ingr, steps]);
  const close = () => { clearDraft(); back(); };

  const append = (box: Box, t: string) => {
    const set = box === 'ingr' ? setIngr : setSteps;
    set((r) => (r.trim() ? r.trimEnd() + '\n' : '') + t.trim());
  };

  const readImage = async (img: File | HTMLCanvasElement) => {
    setPhase('reading'); setErr(''); setProgress({ status: 'Laddar textläsaren', pct: 0 });
    try {
      const { createWorker } = await import('tesseract.js');
      // Filerna ligger i appen (public/tesseract), inte på en extern server.
      const base = new URL(`${import.meta.env.BASE_URL}tesseract/`, window.location.href).href;
      const worker = await createWorker('swe', 1, {
        workerPath: `${base}worker.min.js`,
        corePath: base,
        langPath: `${base}lang`,
        gzip: false,
        logger: (m: { status: string; progress: number }) => setProgress({ status: STATUS[m.status] ?? 'Arbetar', pct: Math.round((m.progress ?? 0) * 100) }),
      });
      const { data } = await worker.recognize(img);
      await worker.terminate();
      if (!data.text.trim()) throw new Error('Ingen text hittades i bilden. Försök med bättre ljus och håll sidan plant.');
      append(target, data.text);
    } catch (e) {
      setErr('Kunde inte läsa texten: ' + (e instanceof Error ? e.message : String(e)));
    }
    setProgress(null);
    setPhase('form');
  };
  const onPhoto = (file: File | undefined) => { if (file) void readImage(file); };
  const openCamera = (box: Box) => { setTarget(box); setPhase('camera'); };

  const ingredients = ingredientsFromText(ingr);
  const stepList = stepsFromText(steps);

  const save = async () => {
    if (!name.trim()) { setNameErr(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!check()) return;
    setSaving(true);
    try {
      const id = await saveRecipe({
        name: name.trim(), effort, portions, source_type: 'book', book_title: book.trim() || null, page: page || null,
        // Delrubriker som "Sås:" blir delar av receptet.
        ingredients, steps: stepList, tagIds,
      });
      clearDraft();
      nav(`/recept/${id}`, { replace: true });
      toast(takeSaveWarning() ?? 'Receptet är sparat');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const fileInput = <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />;

  if (phase === 'camera') {
    return <CameraView fileInput={fileInput} onPickFile={() => fileRef.current?.click()} onClose={() => setPhase('form')} onCapture={(c) => void readImage(c)} />;
  }

  if (phase === 'reading') {
    return (
      <div className="col" style={{ minHeight: '100dvh', alignItems: 'flex-start', justifyContent: 'center', gap: 12, padding: '0 28px' }}>
        <Spinner size={28} border={4} />
        <h2 style={{ margin: 0, fontSize: 28 }}>{progress?.status ?? 'Läser texten'}…{progress && progress.pct > 0 ? ` ${progress.pct} %` : ''}</h2>
        <p style={{ margin: 0, color: 'var(--color-neutral-700)' }}>Texten tolkas i telefonen. Första gången laddas den svenska språkmodellen ner, vilket kan ta en stund.</p>
      </div>
    );
  }

  return (
    <div className="screen no-tabs narrow" style={{ paddingBottom: 60 }}>
      <TopBar onClose={close} title="Från kokbok" />
      <h1 style={{ margin: '0 0 16px', fontSize: 32 }}>Recept ur en kokbok</h1>
      <div className="col" style={{ gap: 16 }}>
        <div className="field"><label>Namn på receptet</label>
          <input className="input big" value={name} onChange={(e) => { setName(e.target.value); setNameErr(false); }} placeholder="t.ex. Kycklinggryta"
            style={{ borderColor: nameErr ? 'var(--color-accent)' : 'var(--color-divider)' }} />
          {nameErr && <div className="err" style={{ marginTop: 6 }}>Receptet behöver ett namn.</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10 }}>
          <div className="field"><label>Bok</label>
            <input className="input big" value={book} onChange={(e) => setBook(e.target.value)} placeholder="Bokens titel" />
          </div>
          <div className="field"><label>Sida</label>
            <input className="input big" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="123" style={{ textAlign: 'center' }} />
          </div>
        </div>
        <BookSuggestions onPick={setBook} />
        <Stepper label="Antal portioner" value={portions} onChange={setPortions} alert={portions !== 4 ? `Receptet är skrivet för ${portions} portioner` : undefined} />

        <details style={{ fontSize: 14, color: 'var(--color-neutral-800)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Så kopierar du texten med kameran</summary>
          <div className="col" style={{ gap: 8, marginTop: 10 }}>
            {PASTE_STEPS.map((t, i) => (
              <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                <span style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontSize: 13 }}>{i + 1}</span>
                <span style={{ paddingTop: 3, textWrap: 'pretty' }}>{t}</span>
              </div>
            ))}
          </div>
        </details>

        <PasteBox label="Ingredienser" count={ingredients.length ? `${ingredients.length} st` : ''} value={ingr} onChange={setIngr} onAppend={(t) => append('ingr', t)}
          onCamera={() => openCamera('ingr')} placeholder={'400 g kycklingfilé\n1 gul lök\n4 dl kokosmjölk'} />
        <PasteBox label="Gör så här" count={stepList.length ? `${stepList.length} steg` : ''} value={steps} onChange={setSteps} onAppend={(t) => append('steps', t)}
          onCamera={() => openCamera('steps')} placeholder={'1. Skär kycklingen i bitar.\n2. Fräs löken.'} />
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: -8 }}>Två spalter? Klistra in en i taget, texten läggs till efter den förra. Delrubriker som ”Sås:” blir delar av receptet.</span>

        {fields}
        {err && <span className="err">{err}</span>}
        <button className="btn btn-primary btn-block" disabled={saving || (!ingredients.length && !stepList.length)} onClick={save} style={{ height: 54, fontSize: 17 }}>{saving ? <Spinner /> : 'Spara recept'}</button>
      </div>
    </div>
  );
}

/** En ruta (ingredienser eller steg) som fylls genom att klistra in text från Kameran, eller genom att fota. */
function PasteBox({ label, count, value, onChange, onAppend, onCamera, placeholder }: {
  label: string; count: string; value: string; onChange: (v: string) => void; onAppend: (t: string) => void; onCamera: () => void; placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [hint, setHint] = useState('');
  /** Markören sist i rutan, på en ny rad om det redan finns text. */
  const focusAtEnd = () => {
    const ta = ref.current;
    if (!ta) return;
    ta.focus();
    const end = ta.value.length;
    ta.setSelectionRange(end, end);
  };
  const paste = async () => {
    setHint('');
    if (value.trim() && !value.endsWith('\n')) onChange(value.trimEnd() + '\n');
    // Fokus direkt i trycket: då kan iPhone öppna tangentbordet och visa "Klistra in"
    // även om urklippsfunktionen nedan nekas (vanligt i appar på hemskärmen).
    focusAtEnd();
    try {
      if (!navigator.clipboard?.readText) throw new Error('saknas');
      const t = await navigator.clipboard.readText();
      if (!t.trim()) throw new Error('tomt');
      onAppend(t);
      ref.current?.blur();
    } catch {
      setHint('Tryck och håll i rutan och välj Klistra in.');
      requestAnimationFrame(focusAtEnd);
    }
  };
  const btn = { height: 36, padding: '0 14px', borderRadius: 999, cursor: 'pointer', font: '700 13px var(--font-body)' } as const;
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 19 }}>{label}{count && <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-accent-2-700)' }}> · {count}</span>}</span>
        <div className="row" style={{ gap: 6 }}>
          <button onClick={paste} style={{ ...btn, border: 0, background: 'var(--color-text)', color: 'var(--color-bg)' }}>Klistra in</button>
          <button onClick={onCamera} aria-label={`Fota ${label.toLowerCase()}`} className="row" style={{ ...btn, gap: 6, border: '1.5px solid var(--color-divider)', background: 'transparent', color: 'var(--color-text)' }}><Ico icon={Camera} size={15} />Fota</button>
        </div>
      </div>
      <textarea ref={ref} className="input" value={value} onChange={(e) => { onChange(e.target.value); setHint(''); }} placeholder={placeholder}
        style={{ borderRadius: 22, minHeight: 150, padding: '12px 16px', fontSize: 16, lineHeight: 1.45 }} />
      {hint && <span className="err" style={{ fontWeight: 600 }}>{hint}</span>}
      {value.trim() && <button onClick={() => onChange('')} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', font: '600 13px var(--font-body)', color: 'var(--color-neutral-700)' }}>Rensa</button>}
    </div>
  );
}

/** Kamerasökare inne i appen, så att appen inte lämnas (och stängs) när man fotar. */
function CameraView({ fileInput, onPickFile, onClose, onCapture }: {
  fileInput: React.ReactNode; onPickFile: () => void; onClose: () => void; onCapture: (c: HTMLCanvasElement) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [camErr, setCamErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kameran går inte att använda i den här webbläsaren.');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false,
        });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
        setReady(true);
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setCamErr(name === 'NotAllowedError'
          ? 'Appen fick inte använda kameran. Tillåt kameran i inställningarna, eller välj en bild.'
          : e instanceof Error ? e.message : 'Kameran kunde inte startas.');
      }
    })();
    return () => { alive = false; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(c);
  };

  const corner = (pos: React.CSSProperties, r: string) => (
    <div style={{ position: 'absolute', width: 38, height: 38, borderColor: 'var(--color-accent-300)', borderStyle: 'solid', borderWidth: 0, borderRadius: r, ...pos }} />
  );
  return (
    <div className="col" style={{ position: 'fixed', inset: 0, left: 'var(--edge)', right: 'var(--edge-r, var(--edge))', background: 'var(--color-neutral-900)', color: 'var(--color-neutral-100)', padding: 'var(--top-pad) 20px 30px', zIndex: 6 }}>
      {fileInput}
      <TopBar dark onClose={onClose} title="Fota kokbokssida" />
      <div style={{ position: 'relative', flex: 1, margin: '0 0 18px', borderRadius: 34, overflow: 'hidden', background: 'repeating-linear-gradient(135deg,var(--color-neutral-800) 0 10px,var(--color-neutral-900) 10px 20px)', display: 'grid', placeItems: 'center' }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: ready ? 'block' : 'none' }} />
        {!ready && !camErr && <Spinner />}
        {camErr && <span style={{ position: 'relative', padding: '0 28px', textAlign: 'center', fontSize: 14 }}>{camErr}</span>}
        {corner({ top: 22, left: 22, borderTopWidth: 4, borderLeftWidth: 4 }, '18px 0 0 0')}
        {corner({ top: 22, right: 22, borderTopWidth: 4, borderRightWidth: 4 }, '0 18px 0 0')}
        {corner({ bottom: 22, left: 22, borderBottomWidth: 4, borderLeftWidth: 4 }, '0 0 0 18px')}
        {corner({ bottom: 22, right: 22, borderBottomWidth: 4, borderRightWidth: 4 }, '0 0 18px 0')}
        {ready && <span style={{ position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)', padding: '7px 14px', borderRadius: 999, background: 'var(--color-neutral-900)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Håll sidan plant och i bra ljus</span>}
      </div>
      <div className="row" style={{ justifyContent: 'center', position: 'relative' }}>
        <button onClick={snap} disabled={!ready} aria-label="Ta bild" style={{ width: 78, height: 78, borderRadius: '50%', border: '4px solid var(--color-neutral-100)', background: 'transparent', padding: 5, cursor: 'pointer', opacity: ready ? 1 : 0.4 }}>
          <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', background: 'var(--color-neutral-100)' }} />
        </button>
      </div>
      <button onClick={onPickFile} style={{ marginTop: 10, alignSelf: 'center', border: 0, background: 'transparent', color: 'var(--color-accent-300)', font: '600 14px var(--font-body)', cursor: 'pointer', padding: 8 }}>
        Välj bild istället
      </button>
    </div>
  );
}
