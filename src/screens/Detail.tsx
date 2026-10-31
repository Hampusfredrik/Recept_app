import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useBack } from '../components/useBack';
import { ArrowUpRight, Heart, BookOpen, CalendarDays, Camera, Check, ChevronLeft, CircleCheck, Globe, NotebookPen, Pencil, Search, Sparkles, Users } from 'lucide-react';
import { creditOf, searchImages, withCredit, type PexelsPhoto } from '../lib/images';
import { useStore } from '../lib/store';
import { EffortIcons, Ico, Sheet, Spinner, Stepper, TagPill, Thumb, useToast, WeekToggle } from '../components/ui';
import { daysSince, iso, isoWeek, lastLabel, shortDate, today, weekAt, WEEKDAYS_SHORT } from '../lib/dates';
import { dayName } from '../lib/logic';
import { amountLabel, domainOf, EFFORT } from '../lib/format';
import { guessUse, parseIngredientLine } from '../../supabase/functions/_shared/parse';
import { NutritionTab } from './NutritionTab';
import type { Recipe } from '../lib/types';

type Tab = 'ingr' | 'steps' | 'nut';

export function Detail() {
  const { id } = useParams();
  const { recipes, tags, plan, cookedToday, toggleChecked, resetChecked, deleteRecipe, toggleFavorite } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const r = recipes.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>('ingr');
  const [port, setPort] = useState<number | null>(null);
  const [writeIngr, setWriteIngr] = useState(false);
  const [pickDay, setPickDay] = useState(false);
  const back = useBack();
  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  if (!r) return <Navigate to="/recept" replace />;
  const portions = port ?? r.portions;
  const scale = portions / r.portions;
  const days = daysSince(r.last_cooked_on);
  const cooked = days === 0;
  const recTags = r.tagIds.map((t) => tags.find((x) => x.id === t)).filter((t) => !!t);
  const thisWeek = weekAt(0).map(iso), nextWeek = weekAt(1).map(iso);
  const plannedDays = plan.filter((p) => p.recipe_id === r.id && (thisWeek.includes(p.date) || nextWeek.includes(p.date))).map((p) => p.date).sort();
  const plannedLabel = plannedDays.map((d) => dayName(d).toLowerCase() + (nextWeek.includes(d) ? ' nästa vecka' : '')).join(', ');
  const sinceLabel = lastLabel(days).replace('Lagad ', '').replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="detail" style={{ paddingBottom: 60, position: 'relative' }}>
      <div className="detail-hero" style={{ position: 'relative', height: 330 }}>
        <Thumb id={r.id} image={r.image_url} radius="0 0 34px 34px" stripeW={10} style={{ position: 'absolute', inset: 0 }} />
        <ImageButton r={r} />
        <PhotoCredit imageUrl={r.image_url} />
      </div>
      <button onClick={back} aria-label="Tillbaka" className="detail-back"
        style={{ position: 'absolute', top: 'max(58px, calc(env(safe-area-inset-top) + 14px))', left: 16, width: 44, height: 44, border: 0, borderRadius: '50%', background: 'var(--color-bg)', boxShadow: 'var(--shadow-md)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--color-text)', zIndex: 3 }}>
        <Ico icon={ChevronLeft} size={20} />
      </button>
      <button onClick={() => toggleFavorite(r.id).then(() => toast(r.is_favorite ? 'Borttagen från favoriter' : 'Sparad som favorit'), (e) => toast(e instanceof Error ? e.message : String(e)))}
        aria-label={r.is_favorite ? 'Ta bort från favoriter' : 'Markera som favorit'} aria-pressed={!!r.is_favorite} className="detail-fav"
        style={{ position: 'absolute', top: 'max(58px, calc(env(safe-area-inset-top) + 14px))', right: 70, width: 44, height: 44, border: 0, borderRadius: '50%', background: 'var(--color-bg)', boxShadow: 'var(--shadow-md)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: r.is_favorite ? 'var(--color-accent)' : 'var(--color-text)', zIndex: 3 }}>
        <Heart size={18} strokeWidth={2.75} fill={r.is_favorite ? 'currentColor' : 'none'} aria-hidden style={{ display: 'block' }} />
      </button>
      <button onClick={() => nav(`/recept/${r.id}/redigera`)} aria-label="Redigera recept" className="detail-edit"
        style={{ position: 'absolute', top: 'max(58px, calc(env(safe-area-inset-top) + 14px))', right: 16, width: 44, height: 44, border: 0, borderRadius: '50%', background: 'var(--color-bg)', boxShadow: 'var(--shadow-md)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--color-text)', zIndex: 3 }}>
        <Ico icon={Pencil} size={18} />
      </button>
      <div className="detail-title" style={{ padding: '22px 20px 0' }}><h1 style={{ margin: 0, fontSize: 31, textWrap: 'pretty' }}>{r.name}</h1></div>

      <div className="detail-body" style={{ padding: '16px 20px 0' }}>
      <div className="col detail-meta" style={{ gap: 18 }}>
        <div className="row" style={{ gap: 16, fontSize: 14, color: 'var(--color-neutral-700)' }}>
          <span className="row" style={{ gap: 6 }}><Ico icon={Users} size={16} />{r.portions} {r.portions === 1 ? 'portion' : 'portioner'}</span>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderRadius: 24, background: 'var(--color-surface)' }}>
          <div className="col" style={{ gap: 1 }}>
            <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', fontWeight: 600 }}>Insats</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 19 }}>{r.effort}/5 · {EFFORT[r.effort]}</span>
          </div>
          <EffortIcons n={r.effort} size={24} gap={4} />
        </div>

        {r.source_type === 'web' && r.url ? (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="row hover-surface"
            style={{ gap: 12, padding: '12px 14px 12px 12px', borderRadius: 24, border: '1.5px solid var(--color-divider)', textDecoration: 'none', color: 'var(--color-text)' }}>
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-2-100)', color: 'var(--color-accent-2-800)', display: 'grid', placeItems: 'center' }}><Ico icon={Globe} /></span>
            <span className="col" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{r.domain || domainOf(r.url)}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Hämtat {r.fetched_at ? shortDate(r.fetched_at) : shortDate(r.created_at)} · Öppna originalet</span>
            </span>
            <Ico icon={ArrowUpRight} color="var(--color-accent-700)" />
          </a>
        ) : (
          <div className="row" style={{ gap: 12, padding: '12px 14px 12px 12px', borderRadius: 24, border: '1.5px solid var(--color-divider)' }}>
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center' }}><Ico icon={BookOpen} /></span>
            <span className="col" style={{ flex: 1 }}><span style={{ fontWeight: 700, fontSize: 15 }}>{r.book_title}</span><span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Kokbok</span></span>
            <span className="col" style={{ flex: 'none', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 11, color: 'var(--color-neutral-700)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Sida</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 22, lineHeight: 1 }}>{r.page || '–'}</span>
            </span>
          </div>
        )}

        <div className="row" style={{ gap: 12, padding: '12px 12px 12px 18px', borderRadius: 24, background: 'var(--color-accent-2-100)', color: 'var(--color-accent-2-900)' }}>
          <span className="col" style={{ flex: 1 }}>
            <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>Senast lagad</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>{sinceLabel}</span>
          </span>
          <button onClick={async () => { await cookedToday(r.id); toast('Markerad som lagad idag'); }}
            className="row" style={{ flex: 'none', gap: 6, height: 40, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer', font: '700 13px var(--font-body)',
              background: cooked ? 'var(--color-accent-2-600)' : 'var(--color-bg)', color: cooked ? 'var(--color-bg)' : 'var(--color-accent-2-900)' }}>
            <Ico icon={CircleCheck} size={16} />{cooked ? 'Lagad idag' : 'Lagade idag'}
          </button>
        </div>

        <div className="row" style={{ gap: 12, padding: '12px 12px 12px 12px', borderRadius: 24, border: '1.5px solid var(--color-divider)' }}>
          <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center' }}><Ico icon={CalendarDays} /></span>
          <span className="col" style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Veckan</span>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
              {plannedDays.length ? 'Planerad ' + plannedLabel : 'Inte planerad'}
            </span>
          </span>
          <button onClick={() => setPickDay(true)} className="row"
            style={{ flex: 'none', gap: 6, height: 40, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer', font: '700 13px var(--font-body)', background: 'var(--color-accent)', color: 'var(--color-bg)' }}>
            {plannedDays.length ? 'Ändra' : 'Lägg i veckan'}
          </button>
        </div>

        {recTags.length > 0 && (
          <div className="wrap">{recTags.map((t) => <TagPill key={t.id} tag={t} style={{ fontSize: 13, padding: '5px 12px', fontWeight: 600 }} />)}</div>
        )}

      </div>

      <div className="col detail-main" style={{ gap: 18 }}>
        <div className="seg2" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 4 }}>
          {([['ingr', 'Ingredienser'], ['steps', 'Gör så här'], ['nut', 'Näring']] as const).map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {tab === 'ingr' && (r.ingredients.length ? (
          <div className="col" style={{ gap: 6 }}>
            <Stepper label="Räknat för" value={portions} onChange={setPort} />
            <div className="col">
              {r.ingredients.map((i) => {
                const c = r.checked.includes(i.id);
                return (
                  <button key={i.id} onClick={() => toggleChecked(r.id, i.id)} aria-pressed={c}
                    style={{ display: 'grid', gridTemplateColumns: '26px 78px 1fr', alignItems: 'center', gap: 10, padding: '11px 0', border: 0, borderBottom: '1px solid var(--color-divider)', background: 'transparent', cursor: 'pointer', textAlign: 'left', font: '15px var(--font-body)', color: 'var(--color-text)', opacity: c ? 0.5 : 1 }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${c ? 'var(--color-accent-2-600)' : 'var(--color-neutral-400)'}`, background: c ? 'var(--color-accent-2-600)' : 'transparent', display: 'grid', placeItems: 'center' }}>
                      <Ico icon={Check} size={12} color="var(--color-bg)" />
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--color-accent-700)', textDecoration: c ? 'line-through' : 'none' }}>{amountLabel(i.amount, i.unit, scale, i.amount_max)}</span>
                    <span style={{ textDecoration: c ? 'line-through' : 'none' }}>{i.name}</span>
                  </button>
                );
              })}
            </div>
            {r.checked.length > 0 && (
              <button className="btn btn-ghost" onClick={() => resetChecked(r.id)} style={{ alignSelf: 'flex-start', color: 'var(--color-accent-700)', marginTop: 4 }}>
                {r.checked.length} av {r.ingredients.length} avbockade · Återställ
              </button>
            )}
          </div>
        ) : (
          <div className="col" style={{ alignItems: 'flex-start', gap: 10, padding: 18, borderRadius: 28, background: 'var(--color-surface)' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{r.source_type === 'book' ? 'Står i boken' : 'Inga ingredienser'}</span>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-800)' }}>
              {r.source_type === 'book' ? `Slå upp sida ${r.page || '–'} i ${r.book_title}. ` : 'Sidan hade inga ingredienser vi kunde läsa. '}
              Skriv in ingredienserna om du vill skala portioner och se näringsvärde.
            </p>
            <button className="btn btn-secondary" style={{ padding: '9px 16px' }} onClick={() => setWriteIngr(true)}>Skriv in ingredienser</button>
          </div>
        ))}

        {tab === 'steps' && (r.steps.length ? <Steps r={r} portions={portions} scale={scale} setPort={setPort} /> : (
          <div style={{ padding: 18, borderRadius: 28, background: 'var(--color-surface)', fontSize: 14 }}>
            {r.source_type === 'book' ? `Instruktionerna finns på sida ${r.page || '–'} i ${r.book_title}.` : 'Instruktionerna finns på originalsidan.'}
          </div>
        ))}

        {tab === 'nut' && <NutritionTab r={r} />}
      </div>

      <Notes r={r} />

      <div className="detail-del" style={{ paddingTop: 28 }}>
        <button className="btn btn-ghost" style={{ color: 'var(--color-neutral-700)' }}
          onClick={async () => { if (confirm(`Ta bort ”${r.name}”? Det går inte att ångra.`)) { await deleteRecipe(r.id); nav('/recept', { replace: true }); } }}>
          Ta bort receptet
        </button>
      </div>
      </div>

      {writeIngr && <WriteIngredients r={r} onClose={() => setWriteIngr(false)} />}
      {pickDay && <WeekDaySheet r={r} onClose={() => setPickDay(false)} />}
    </div>
  );
}

function Steps({ r, portions, scale, setPort }: { r: Recipe; portions: number; scale: number; setPort: (n: number) => void }) {
  const names = r.ingredients.map((i) => i.name);
  return (
    <div className="col" style={{ gap: 18 }}>
      {r.ingredients.length > 0 && <Stepper label="Mängder för" value={portions} onChange={setPort} />}
      {r.steps.map((s, k) => {
        const used = s.ingredient_ids?.length
          ? s.ingredient_ids.map((iid) => r.ingredients.find((i) => i.id === Number(iid))).filter((i) => !!i)
          : guessUse(s.text, names).map((x) => r.ingredients[x]);
        return (
          <div key={s.id} className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 32, height: 32, borderRadius: '50%', background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontSize: 15 }}>{k + 1}</span>
            <div className="col" style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <p style={{ margin: '4px 0 0', fontSize: 15, textWrap: 'pretty' }}>{s.text}</p>
              {used.length > 0 && (
                <div className="wrap">
                  {used.map((u) => (
                    <span key={u.id} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, padding: '4px 11px', borderRadius: 999, background: 'var(--color-surface)', fontSize: 13 }}>
                      {u.amount != null && <b style={{ color: 'var(--color-accent-700)' }}>{amountLabel(u.amount, u.unit, scale, u.amount_max)}</b>}<span>{u.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Notes({ r }: { r: Recipe }) {
  const { saveNote } = useStore();
  const [text, setText] = useState(r.note?.text ?? '');
  const dirty = useRef(false);
  const focused = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  // Ta emot ändringar från den andra personen när man inte själv skriver.
  useEffect(() => {
    if (!focused.current && !dirty.current) setText(r.note?.text ?? '');
  }, [r.note?.text, r.note?.updated_at]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (v: string) => {
    setText(v);
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => { await saveNote(r.id, v); dirty.current = false; }, 600);
  };

  return (
    <div className="col detail-notes" style={{ gap: 8, paddingTop: 28 }}>
      <div className="row" style={{ gap: 8 }}><Ico icon={NotebookPen} color="var(--color-accent-700)" /><h4 style={{ margin: 0, fontSize: 19 }}>Mina anteckningar</h4></div>
      <textarea className="input" value={text} onChange={(e) => onChange(e.target.value)}
        onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; }}
        placeholder="Vad ändrade du? Vad vill du komma ihåg till nästa gång?" style={{ borderRadius: 24, minHeight: 96, padding: '12px 16px', fontSize: 16 }} />
    </div>
  );
}

function WriteIngredients({ r, onClose }: { r: Recipe; onClose: () => void }) {
  const { addIngredients } = useStore();
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const lines = v.split('\n').map((x) => x.trim()).filter(Boolean).map(parseIngredientLine);
    if (!lines.length) return onClose();
    setBusy(true);
    await addIngredients(r.id, lines);
    setBusy(false);
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <h3>Skriv in ingredienser</h3>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: -8 }}>En per rad, t.ex. ”400 g kycklingfilé”.</span>
      <textarea className="input" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder={'400 g kycklingfilé\n1 gul lök\n4 dl kokosmjölk'}
        style={{ borderRadius: 24, minHeight: 160, padding: '12px 16px', fontSize: 16 }} />
      <button className="btn btn-primary btn-block" disabled={busy} onClick={save} style={{ height: 52, fontSize: 16 }}>Spara ingredienser</button>
    </Sheet>
  );
}

/** Välj dag i veckan för receptet. Tryck på en dag där receptet redan ligger för att ta bort det. */
function WeekDaySheet({ r, onClose }: { r: Recipe; onClose: () => void }) {
  const { recipes, plan, setPlan } = useStore();
  const toast = useToast();
  const t = today();
  // Från lördag visas nästa vecka direkt, eftersom det mesta av den här veckan har passerat.
  const [offset, setOffset] = useState(new Date().getDay() === 6 || new Date().getDay() === 0 ? 1 : 0);
  const days = weekAt(offset);
  const when = (date: string) => dayName(date).toLowerCase() + (offset === 1 ? ' nästa vecka' : '');
  const choose = async (date: string, mine: boolean) => {
    if (mine) {
      await setPlan(date, null);
      toast(`Borttaget från ${when(date)}`);
    } else {
      await setPlan(date, r.id);
      toast(`Lagt på ${when(date)}`);
      onClose();
    }
  };
  return (
    <Sheet onClose={onClose} style={{ gap: 12 }}>
      <div className="col" style={{ gap: 2 }}>
        <h3>Lägg i veckan</h3>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Vecka {isoWeek(days[0])} · tryck på en dag</span>
      </div>
      <WeekToggle value={offset} onChange={setOffset} />
      <div className="col" style={{ gap: 6 }}>
        {days.map((d, i) => {
          const date = iso(d);
          const entry = plan.find((p) => p.date === date);
          const other = entry && entry.recipe_id !== r.id ? recipes.find((x) => x.id === entry.recipe_id) : undefined;
          const mine = entry?.recipe_id === r.id;
          const past = date < t, isToday = date === t;
          return (
            <button key={date} disabled={past} onClick={() => choose(date, mine)} className="row hover-surface"
              style={{ gap: 12, padding: 6, borderRadius: 22, border: 0, background: mine ? 'var(--color-accent-2-100)' : 'transparent', cursor: past ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', color: 'var(--color-text)', opacity: past ? 0.45 : 1 }}>
              <span className="col" style={{ flex: 'none', width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16,
                background: isToday ? 'var(--color-accent)' : 'var(--color-surface)', color: isToday ? 'var(--color-bg)' : 'var(--color-text)' }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{WEEKDAYS_SHORT[i]}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 17, lineHeight: 1.1 }}>{d.getDate()}</span>
              </span>
              <span className="col" style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{mine ? 'Det här receptet' : other ? other.name : 'Ledig'}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                  {past ? 'Har varit' : mine ? 'Tryck för att ta bort' : other ? 'Tryck för att byta ut' : ''}
                </span>
              </span>
              {mine && <Ico icon={Check} size={18} color="var(--color-accent-2-700)" style={{ marginRight: 8 }} />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/** Lägg till eller byt bild på receptet (bibliotek eller kamera). */
function ImageButton({ r }: { r: Recipe }) {
  const { setRecipeImage } = useStore();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [find, setFind] = useState(false);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try { await setRecipeImage(r.id, file); toast('Bilden är sparad'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Kunde inte spara bilden'); }
    setBusy(false);
  };
  const remove = async () => {
    if (!confirm('Ta bort bilden?')) return;
    setBusy(true);
    try { await setRecipeImage(r.id, null); toast('Bilden är borttagen'); } catch { toast('Kunde inte ta bort bilden'); }
    setBusy(false);
  };
  const pill = { height: 40, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--color-bg)', boxShadow: 'var(--shadow-md)', cursor: 'pointer', font: '700 13px var(--font-body)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 } as const;
  return (
    <div className="row" style={{ position: 'absolute', right: 16, bottom: 16, gap: 8, zIndex: 2 }}>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      {r.image_url && !busy && <button onClick={remove} style={pill}>Ta bort</button>}
      {!busy && <button onClick={() => setFind(true)} style={pill}><Ico icon={Sparkles} size={16} />Hitta bild</button>}
      <button onClick={() => ref.current?.click()} disabled={busy} style={pill}>
        {busy ? <Spinner size={16} border={2} /> : <Ico icon={Camera} size={16} />}
        {busy ? 'Sparar…' : r.image_url ? 'Byt bild' : 'Lägg till bild'}
      </button>
      {find && <ImageSearchSheet r={r} onClose={() => setFind(false)} />}
    </div>
  );
}

/** Fotografens namn och Pexels, som deras villkor kräver. */
function PhotoCredit({ imageUrl }: { imageUrl: string | null }) {
  const c = creditOf(imageUrl);
  if (!c) return null;
  return (
    <span style={{ position: 'absolute', left: 16, bottom: 66, zIndex: 2, padding: '3px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-neutral-900) 55%, transparent)', color: 'var(--color-neutral-100)', fontSize: 11 }}>
      Foto: <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{c.name}</a> / <a href={c.photo} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>Pexels</a>
    </span>
  );
}

/** Bildförslag från Pexels; användaren väljer en bild. */
function ImageSearchSheet({ r, onClose }: { r: Recipe; onClose: () => void }) {
  const { setRecipeImageUrl } = useStore();
  const toast = useToast();
  const [q, setQ] = useState(r.name);
  const [photos, setPhotos] = useState<PexelsPhoto[] | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const search = async (query = q) => {
    if (!query.trim()) return;
    setLoading(true); setErr('');
    try { setPhotos((await searchImages(query.trim())).slice(0, 6)); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setLoading(false);
  };
  useEffect(() => { void search(r.name); }, []); // söker direkt på receptets namn
  const choose = async (p: PexelsPhoto) => {
    try { await setRecipeImageUrl(r.id, withCredit(p)); toast('Bilden är sparad'); onClose(); } catch { toast('Kunde inte spara bilden'); }
  };
  return (
    <Sheet onClose={onClose} className="sheet-top" style={{ gap: 12 }}>
      <h3>Hitta bild</h3>
      <form onSubmit={(e) => { e.preventDefault(); void search(); }} className="row" style={{ gap: 8 }}>
        <label className="row" style={{ flex: 1, gap: 10, height: 48, padding: '0 16px', borderRadius: 999, background: 'var(--color-surface)', color: 'var(--color-neutral-700)' }}>
          <Ico icon={Search} />
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" enterKeyHint="search" placeholder="t.ex. lasagne"
            style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, color: 'var(--color-text)', outline: 'none' }} />
        </label>
        <button className="btn btn-secondary" type="submit" style={{ flex: 'none', height: 48, padding: '0 16px' }}>Sök</button>
      </form>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: -4 }}>Inga bra träffar? Prova ett enklare ord eller på engelska, t.ex. "lasagna".</span>
      {loading && <div className="row" style={{ gap: 8 }}><Spinner /> Söker…</div>}
      {err && <span className="err">{err}</span>}
      {photos && !loading && photos.length === 0 && <span className="muted" style={{ fontSize: 14 }}>Inga bilder hittades.</span>}
      {photos && photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {photos.map((p) => (
            <button key={p.id} onClick={() => choose(p)} aria-label={p.alt || 'Välj bild'}
              style={{ position: 'relative', aspectRatio: '4 / 3', border: 0, padding: 0, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: `var(--color-surface) center/cover no-repeat url("${p.thumb}")` }}>
              <span style={{ position: 'absolute', left: 6, bottom: 6, right: 6, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-neutral-900) 55%, transparent)', color: 'var(--color-neutral-100)', fontSize: 10, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.photographer}</span>
            </button>
          ))}
        </div>
      )}
      <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Bilder från Pexels</a>
    </Sheet>
  );
}
