import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, MessageSquare, Refrigerator, RotateCcw, Shuffle, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUi } from '../components/uiState';
import { EffortIcons, Ico, Thumb, useToast } from '../components/ui';
import { byLongestAgo, dayName, firstEmptyDay, heroRecipe, suggestable } from '../lib/logic';
import { daysSince, lastLabel, today, todayKicker } from '../lib/dates';
import { EFFORT } from '../lib/format';

const BY_KEY = 'receptappen.homeBy';

export function Home() {
  const { recipes: allRecipes, tags, plan, setPlan, household, feedback, members, memberName } = useStore();
  const named = members.filter((m) => m.display_name);
  // Vald person på startsidan (sparas på enheten). Bara den personens recept visas.
  const [byPick, setByPick] = useState<string | null>(() => { try { return localStorage.getItem(BY_KEY); } catch { return null; } });
  const by = byPick && named.some((m) => m.user_id === byPick) ? byPick : null;
  const pickBy = (id: string | null) => {
    setByPick(id);
    try { if (id) localStorage.setItem(BY_KEY, id); else localStorage.removeItem(BY_KEY); } catch { /* ingen lagring */ }
  };
  // Förslagen: vald persons recept, utan taggar markerade "Inte i förslag".
  const recipes = suggestable(by ? allRecipes.filter((r) => r.created_by === by) : allRecipes, tags);
  const openFeedback = feedback.filter((f) => !f.done_at).length;
  const { setSheet } = useUi();
  const nav = useNavigate();
  const toast = useToast();
  const [trioOff, setTrioOff] = useState([0, 0, 0]);
  const open = (id: string) => nav(`/recept/${id}`);

  const todayEntry = plan.find((p) => p.date === today());
  const todayR = todayEntry && allRecipes.find((r) => r.id === todayEntry.recipe_id);
  // Gamla planer räknas inte: bara det som ligger från idag och framåt.
  const upcoming = plan.filter((p) => p.date >= today());
  const hero = heroRecipe(recipes, upcoming);
  const heroPlanned = !!hero && upcoming.some((p) => p.recipe_id === hero.id);

  const planHero = async () => {
    if (!hero) return;
    if (heroPlanned) return nav('/veckan');
    const d = firstEmptyDay(plan);
    if (!d) return toast('Veckan är redan full');
    await setPlan(d.date, hero.id);
    toast(`Lagt på ${dayName(d.date).toLowerCase()}${d.nextWeek ? ' nästa vecka' : ''}`);
  };

  const trio = [1, 2, 3].map((lvl, k) => {
    const pool = recipes.filter((r) => r.effort === lvl).sort(byLongestAgo);
    if (!pool.length) return null;
    return { lvl, k, r: pool[trioOff[k] % pool.length], canSwap: pool.length > 1 };
  }).filter((x) => x !== null);

  return (
    <div className="screen home" style={{ display: 'grid', alignContent: 'start', gridTemplateColumns: 'minmax(0,1fr)', gap: 26 }}>
      <div className="col home-head" style={{ gap: 2 }}>
        <div className="row" style={{ gap: 8, margin: '-12px 0 12px', justifyContent: 'space-between' }}>
          <button onClick={() => setSheet({ kind: 'household' })} aria-label={`Ert kök: ${household?.name ?? ''}`} className="row"
            style={{ minWidth: 0, gap: 8, height: 36, padding: '0 14px 0 6px', borderRadius: 999, border: 0, background: 'var(--color-surface)', cursor: 'pointer', font: '700 14px var(--font-body)', color: 'var(--color-text)' }}>
            <span style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', background: 'var(--color-accent)', color: 'var(--color-bg)', display: 'grid', placeItems: 'center' }}><Ico icon={Users} size={14} /></span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{household?.name ?? 'Ert kök'}</span>
          </button>
          <button onClick={() => nav('/feedback')} aria-label="Feedback och förslag" className="row home-feedback"
            style={{ flex: 'none', gap: 6, height: 36, padding: '0 12px', borderRadius: 999, border: 0, background: 'var(--color-surface)', cursor: 'pointer', font: '700 13px var(--font-body)', color: 'var(--color-neutral-800)' }}>
            <Ico icon={MessageSquare} size={15} />Feedback{openFeedback ? ` · ${openFeedback}` : ''}
          </button>
        </div>
        <span className="kicker">{todayKicker()}</span>
        <h1 className="h1">Vad blir det idag?</h1>
        {named.length > 1 && (
          <div className="wrap" role="group" aria-label="Visa recept inlagda av" style={{ marginTop: 12 }}>
            {[{ user_id: null as string | null, display_name: 'Alla' }, ...named].map((m) => (
              <button key={m.user_id ?? 'alla'} className={'chip' + (by === m.user_id ? ' on' : '')} aria-pressed={by === m.user_id} onClick={() => pickBy(m.user_id)}>
                {m.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {todayR && (
        <div onClick={() => open(todayR.id)} className="row home-today" style={{ gap: 12, padding: '12px 16px 12px 12px', marginTop: -10, borderRadius: 24, background: 'var(--color-accent-2-100)', color: 'var(--color-accent-2-900)', cursor: 'pointer' }}>
          <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-2-600)', display: 'grid', placeItems: 'center' }}><Ico icon={CalendarDays} size={18} color="var(--color-bg)" /></span>
          <span className="col" style={{ flex: 1 }}><span style={{ fontSize: 12, fontWeight: 700 }}>Planerat idag</span><span style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>{todayR.name}</span></span>
        </div>
      )}

      {hero ? (
        <div className="col home-hero" style={{ borderRadius: 34, background: 'var(--color-surface)' }}>
          <div onClick={() => open(hero.id)} style={{ height: 190, borderRadius: '34px 34px 0 0', padding: 16, cursor: 'pointer', position: 'relative' }}>
            <Thumb id={hero.id} image={hero.image_url} radius="34px 34px 0 0" stripeW={10} style={{ position: 'absolute', inset: 0 }} />
            <span style={{ position: 'relative', padding: '6px 12px', borderRadius: 999, background: 'var(--color-bg)', fontSize: 12, fontWeight: 700, color: 'var(--color-accent-800)' }}>Länge sedan sist</span>
          </div>
          <div className="col" style={{ gap: 10, padding: '16px 18px 18px' }}>
            <div onClick={() => open(hero.id)} role="link" style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1.1, textWrap: 'pretty', cursor: 'pointer' }}>{hero.name}</div>
            <div className="row" style={{ gap: 10, fontSize: 13, color: 'var(--color-neutral-800)' }}>
              <EffortIcons n={hero.effort} size={14} gap={2} />
              <span>{lastLabel(daysSince(hero.last_cooked_on))}</span>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary" onClick={() => open(hero.id)} style={{ flex: 1, height: 46, fontSize: 15 }}>Visa receptet</button>
              <button className="btn btn-secondary" onClick={planHero} style={{ flex: 'none', height: 46, padding: '0 16px', fontSize: 15 }}>{heroPlanned ? 'I veckan ✓' : 'Lägg i veckan'}</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="col home-hero" style={{ gap: 10, padding: 18, borderRadius: 34, background: 'var(--color-surface)', alignItems: 'flex-start' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 22 }}>{by ? `${memberName(by)} har inga recept än` : 'Inga recept än'}</span>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>{by ? 'Recept som saknar namn på vem som lade in dem kan få det under Redigera.' : 'Spara ert första recept från en länk eller en kokbok.'}</p>
          <button className="btn btn-primary" onClick={() => setSheet({ kind: 'add' })} style={{ height: 46, fontSize: 15, padding: '0 18px' }}>Lägg till recept</button>
        </div>
      )}

      {trio.length > 0 && (
        <div className="col home-trio" style={{ gap: 10 }}>
          <div className="col">
            <h3 style={{ margin: 0, fontSize: 22 }}>Ett av varje</h3>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Från superlätt till medel, det du lagat minst nyligen</span>
          </div>
          {trio.map(({ lvl, k, r, canSwap }) => (
            <div key={lvl} className="row" style={{ gap: 12, padding: 10, borderRadius: 26, border: '1.5px solid var(--color-divider)' }}>
              <Thumb id={r.id} image={r.image_url} size={58} radius={20} onClick={() => open(r.id)} />
              <div onClick={() => open(r.id)} className="col" style={{ flex: 1, minWidth: 0, gap: 3, cursor: 'pointer' }}>
                <span className="row" style={{ gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
                  <EffortIcons n={lvl} size={11} />{EFFORT[lvl]}
                </span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, lineHeight: 1.15 }}>{r.name}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{lastLabel(daysSince(r.last_cooked_on))}</span>
              </div>
              {canSwap && (
                <button className="hover-n300" onClick={() => setTrioOff((o) => o.map((x, j) => (j === k ? x + 1 : x)))} aria-label="Byt förslag"
                  style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', border: 0, background: 'var(--color-surface)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--color-neutral-800)' }}>
                  <Ico icon={RotateCcw} size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="home-tiles" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <BigTile onClick={() => setSheet({ kind: 'random', by })} bg="var(--color-accent-100)" hover="var(--color-accent-200)" fg="var(--color-accent-900)" dot="var(--color-accent)" icon={Shuffle} title="Slumpa" sub="Välj insats och tagg" />
        <BigTile onClick={() => nav('/laga')} bg="var(--color-accent-2-100)" hover="var(--color-accent-2-200)" fg="var(--color-accent-2-900)" dot="var(--color-accent-2-600)" icon={Refrigerator} title="Vad kan jag laga?" sub="Utgå från det du har" />
      </div>
    </div>
  );
}

function BigTile({ onClick, bg, hover, fg, dot, icon, title, sub }: { onClick: () => void; bg: string; hover: string; fg: string; dot: string; icon: typeof Shuffle; title: string; sub: string }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, padding: 16, borderRadius: 28, border: 0, background: h ? hover : bg, color: fg, cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ width: 44, height: 44, borderRadius: '50%', background: dot, display: 'grid', placeItems: 'center' }}><Ico icon={icon} size={20} color="var(--color-bg)" /></span>
      <span className="col"><span style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{title}</span><span style={{ fontSize: 12 }}>{sub}</span></span>
    </button>
  );
}
