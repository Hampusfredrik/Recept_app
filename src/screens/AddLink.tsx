import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { functionError } from '../lib/nutrition';
import { useStore } from '../lib/store';
import { Ico, Spinner, Thumb, TopBar, useToast } from '../components/ui';
import { KcalEstimate, useSaveFields } from '../components/SaveFields';
import { useBack } from '../components/useBack';
import { domainOf } from '../lib/format';
import type { ParsedIngredient } from '../../supabase/functions/_shared/parse';

interface Imported {
  found: 'recipe' | 'html' | 'opengraph';
  url: string;
  domain: string;
  name: string;
  image: string | null;
  portions: number | null;
  ingredients: ParsedIngredient[];
  steps: string[];
}

const URL_RE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i;

export function AddLink() {
  const nav = useNavigate();
  const toast = useToast();
  const { saveRecipe } = useStore();
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [clip, setClip] = useState<string | null>(null);
  const [phase, setPhase] = useState<'input' | 'loading' | 'review'>('input');
  const [data, setData] = useState<Imported | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { effort, tagIds, fields, check } = useSaveFields();
  const domain = domainOf(url || 'webbsidan');
  const back = useBack();

  const readClip = async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (URL_RE.test(t)) { setUrl(t); setErr(''); setClip(t); } else setClip('');
    } catch { setClip(''); }
  };

  const fetchLink = async () => {
    const u = url.trim();
    if (!URL_RE.test(u)) return setErr('Klistra in en webbadress, t.ex. https://www.koket.se/…');
    setErr(''); setPhase('loading');
    const { data: res, error } = await supabase.functions.invoke('import-recipe', { body: { url: u } });
    if (error || !res || res.error) {
      setPhase('input');
      const why = res?.error ?? (error ? (await functionError(error, 'import-recipe')).message : 'inget svar');
      return setErr(`Kunde inte läsa sidan: ${why}`);
    }
    setData(res as Imported);
    setName((res as Imported).name);
    setPhase('review');
  };

  const save = async () => {
    if (!data || !check()) return;
    setSaving(true);
    try {
      const id = await saveRecipe({
        name: name.trim() || 'Namnlöst recept', effort, portions: data.portions ?? 4, source_type: 'web',
        url: data.url, domain: data.domain, fetched_at: new Date().toISOString(), image_url: data.image,
        ingredients: data.ingredients, steps: data.steps, tagIds,
      });
      nav(`/recept/${id}`, { replace: true });
      toast('Receptet är sparat');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="screen no-tabs narrow">
      <TopBar onClose={back} title="Från webben" />

      {phase === 'input' && (
        <>
          <h1 style={{ margin: '0 0 8px', fontSize: 34 }}>Klistra in en länk</h1>
          <p style={{ margin: '0 0 22px', color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>Vi läser namn, bild, ingredienser och steg från sidan. Du får granska allt innan det sparas.</p>
          <label className="row" style={{ gap: 10, height: 54, padding: '0 18px', borderRadius: 999, background: 'var(--color-surface)', border: `1.5px solid ${err ? 'var(--color-accent)' : 'transparent'}` }}>
            <Ico icon={LinkIcon} color="var(--color-neutral-700)" />
            <input value={url} onChange={(e) => { setUrl(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && fetchLink()}
              placeholder="https://" inputMode="url" type="url" autoCapitalize="off" autoCorrect="off"
              style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, outline: 'none', color: 'var(--color-text)' }} />
          </label>
          {err && <div className="err" style={{ margin: '8px 0 0 18px' }}>{err}</div>}
          {clip !== '' && (
            <button onClick={readClip} className="row" style={{ marginTop: 12, gap: 8, maxWidth: '100%', padding: '8px 14px', borderRadius: 999, border: '1.5px dashed var(--color-neutral-400)', background: 'transparent', cursor: 'pointer', font: '500 13px var(--font-body)', color: 'var(--color-neutral-800)' }}>
              <span style={{ flex: 'none', fontWeight: 700 }}>Urklipp:</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clip ? clip.replace(/^https?:\/\/(www\.)?/, '') : 'tryck för att klistra in länken'}</span>
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={fetchLink} style={{ height: 54, marginTop: 26, fontSize: 17 }}>Hämta recept</button>
        </>
      )}

      {phase === 'loading' && (
        <>
          <div className="row" style={{ gap: 10, marginBottom: 22 }}><Spinner /><span style={{ fontWeight: 600 }}>Läser {domain}…</span></div>
          <div className="col skeleton" style={{ gap: 12 }}>
            <div style={{ height: 190, borderRadius: 30, background: 'var(--color-surface)' }} />
            <div style={{ height: 30, width: '80%', borderRadius: 999, background: 'var(--color-surface)' }} />
            <div style={{ height: 16, width: '50%', borderRadius: 999, background: 'var(--color-surface)' }} />
            <div style={{ height: 54, borderRadius: 24, background: 'var(--color-surface)', marginTop: 10 }} />
            <div style={{ height: 54, borderRadius: 24, background: 'var(--color-surface)' }} />
          </div>
        </>
      )}

      {phase === 'review' && data && (
        <div className="col" style={{ gap: 18 }}>
          <div className="col" style={{ gap: 4 }}>
            <span style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-accent-2-700)', fontWeight: 700 }}>Hittat på {data.domain}</span>
            <h1 style={{ margin: 0, fontSize: 30 }}>Granska och spara</h1>
          </div>
          <Thumb id={data.url} image={data.image} radius={30} stripeW={8} style={{ height: 170 }} />
          <div className="field"><label>Namn</label><input className="input big" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="col" style={{ gap: 8, padding: '14px 16px', borderRadius: 24, background: data.found === 'recipe' ? 'var(--color-accent-2-100)' : 'var(--color-accent-100)', color: data.found === 'recipe' ? 'var(--color-accent-2-900)' : 'var(--color-accent-900)' }}>
            {data.found === 'opengraph' && <span style={{ fontSize: 14 }}>Sidan saknar receptdata. Bara titel och bild kunde läsas.</span>}
            {data.found === 'html' && <span style={{ fontSize: 14 }}>Sidan saknar receptdata, så receptet lästes ur texten. Kontrollera ingredienser och steg efter att det sparats.</span>}
            {[['Ingredienser', `${data.ingredients.length} st`], ['Steg', `${data.steps.length} st`], ['Portioner', data.portions ? String(data.portions) : '–']].map(([label, val]) => (
              <div key={label} className="row" style={{ gap: 10, fontSize: 14 }}>
                <span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', background: 'var(--color-accent-2-600)', display: 'grid', placeItems: 'center' }}><Ico icon={Check} size={12} color="var(--color-bg)" /></span>
                <span style={{ flex: 1 }}>{label}</span><b>{val}</b>
              </div>
            ))}
          </div>
          {fields}
          {data.ingredients.length > 0 && <KcalEstimate lines={data.ingredients} portions={data.portions ?? 4} />}
          {err && <span className="err">{err}</span>}
          <button className="btn btn-primary btn-block" disabled={saving} onClick={save} style={{ height: 54, fontSize: 17 }}>{saving ? <Spinner /> : 'Spara recept'}</button>
        </div>
      )}
    </div>
  );
}
