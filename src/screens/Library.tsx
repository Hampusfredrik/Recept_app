import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { LIB_BY_KEY, useUi } from '../components/uiState';
import { EffortIcons, EffortPicker, Ico, Sheet, TagPill, Thumb } from '../components/ui';
import { emptyFilter, FAV_CHIP, filterCount, filterRecipes, toggle, type LibFilter } from '../lib/logic';
import { EFFORT, sourceLabel } from '../lib/format';
import { TagsSheet } from '../sheets/TagsSheet';

export function Library() {
  const { recipes, tags, members, memberName } = useStore();
  const named = members.filter((m) => m.display_name);
  const by = (r: { created_by?: string | null }) => { const n = memberName(r.created_by); return n ? ` · ${n}` : ''; };
  const { filter: f, setFilter, view, setView } = useUi();
  const [showFilter, setShowFilter] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const nav = useNavigate();
  // Sparad person som inte (längre) finns bland köket namn räknas inte, så att listan aldrig blir tom utan synlig orsak.
  const items = filterRecipes(recipes, tags, f.by && !named.some((m) => m.user_id === f.by) ? { ...f, by: null } : f);
  const n = filterCount(f);
  const set = (p: Partial<LibFilter>) => setFilter((x) => ({ ...x, ...p }));
  const tagById = (id: string) => tags.find((t) => t.id === id);

  const segBtn = (on: boolean) => ({ width: 38, height: 38, border: 0, borderRadius: 999, display: 'grid', placeItems: 'center', cursor: 'pointer',
    background: on ? 'var(--color-bg)' : 'transparent', color: on ? 'var(--color-text)' : 'var(--color-neutral-600)' } as const);

  return (
    <div className="screen wide">
      <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="kicker">{recipes.length} sparade</span>
          <h1 className="h1">Mina recept</h1>
        </div>
        <div className="row" style={{ gap: 2, padding: 3, borderRadius: 999, background: 'var(--color-surface)' }}>
          <button onClick={() => setView('grid')} aria-label="Kort" aria-pressed={view === 'grid'} style={segBtn(view === 'grid')}><Ico icon={LayoutGrid} /></button>
          <button onClick={() => setView('list')} aria-label="Lista" aria-pressed={view === 'list'} style={segBtn(view === 'list')}><Ico icon={List} /></button>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <label className="row" style={{ flex: 1, gap: 10, height: 48, padding: '0 16px', borderRadius: 999, background: 'var(--color-surface)', color: 'var(--color-neutral-700)' }}>
          <Ico icon={Search} />
          <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Sök recept, tagg eller bok" type="search"
            style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 15, color: 'var(--color-text)', outline: 'none' }} />
          {f.q && <button onClick={() => set({ q: '' })} aria-label="Rensa" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--color-neutral-700)' }}><Ico icon={X} size={16} /></button>}
        </label>
        <button onClick={() => setShowFilter(true)} aria-label="Filtrera"
          style={{ position: 'relative', width: 48, height: 48, flex: 'none', border: 0, borderRadius: 999, display: 'grid', placeItems: 'center', cursor: 'pointer',
            background: n ? 'var(--color-text)' : 'var(--color-surface)', color: n ? 'var(--color-bg)' : 'var(--color-text)' }}>
          <Ico icon={SlidersHorizontal} size={20} />
          {n > 0 && <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, background: 'var(--color-accent-2-700)', color: 'var(--color-bg)', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{n}</span>}
        </button>
      </div>

      {named.length > 1 && (
        <div className="seg2" role="group" aria-label="Visa recept inlagda av" style={{ gridTemplateColumns: `repeat(${named.length + 1}, 1fr)`, marginBottom: 12 }}>
          {[{ user_id: null as string | null, display_name: 'Alla' }, ...named].map((m) => (
            <button key={m.user_id ?? 'alla'} className={(f.by ?? null) === m.user_id ? 'on' : ''} aria-pressed={(f.by ?? null) === m.user_id}
              onClick={() => { set({ by: m.user_id }); try { if (m.user_id) localStorage.setItem(LIB_BY_KEY, m.user_id); else localStorage.removeItem(LIB_BY_KEY); } catch { /* ingen lagring */ } }}
              style={{ height: 38 }}>{m.display_name}</button>
          ))}
        </div>
      )}

      <div className="hscroll" style={{ marginBottom: 20 }}>
        {[{ id: null as string | null, name: 'Alla' }, ...(recipes.some((r) => r.is_favorite) || f.chip === FAV_CHIP ? [{ id: FAV_CHIP, name: '♥ Favoriter' }] : []), ...tags].map((c) => (
          <button key={c.id ?? 'alla'} className={'chip' + (f.chip === c.id ? ' on' : '')} onClick={() => set({ chip: c.id })} style={{ padding: '0 16px' }}>{c.name}</button>
        ))}
        <button className="chip" onClick={() => setShowTags(true)} style={{ padding: '0 16px', color: 'var(--color-neutral-700)' }}>Hantera taggar</button>
      </div>

      {items.length === 0 && (
        <div className="col" style={{ alignItems: 'flex-start', gap: 10, padding: '32px 4px' }}>
          <h3 style={{ margin: 0, fontSize: 22 }}>{recipes.length ? 'Inga recept matchar' : 'Inga recept än'}</h3>
          <p className="muted" style={{ margin: 0 }}>{recipes.length ? 'Prova en annan sökning eller rensa filtren.' : 'Tryck på plusknappen för att spara ert första recept.'}</p>
          {recipes.length > 0 && <button className="btn btn-secondary" onClick={() => { setFilter(emptyFilter); try { localStorage.removeItem(LIB_BY_KEY); } catch { /* ingen lagring */ } }}>Rensa filter</button>}
        </div>
      )}

      {view === 'grid' && items.length > 0 && (
        <div className="lib-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {items.map((r) => (
            <div key={r.id} onClick={() => nav(`/recept/${r.id}`)} className="col" style={{ borderRadius: 26, background: 'var(--color-surface)', overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{ position: 'relative' }}>
                <Thumb id={r.id} image={r.image_url} radius={0} stripeW={8} style={{ height: 118 }} />
                {r.is_favorite && <FavBadge style={{ position: 'absolute', top: 8, right: 8 }} />}
              </div>
              <div className="col" style={{ gap: 7, padding: '11px 13px 14px' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, lineHeight: 1.15, textWrap: 'pretty' }}>{r.name}</div>
                <EffortIcons n={r.effort} size={14} gap={2} />
                <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{sourceLabel(r)}{by(r)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'list' && items.length > 0 && (
        <div className="col lib-list" style={{ gap: 4 }}>
          {items.map((r) => (
            <div key={r.id} className="list-row" onClick={() => nav(`/recept/${r.id}`)}>
              <Thumb id={r.id} image={r.image_url} size={62} radius={20} />
              <div className="col" style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, lineHeight: 1.15 }}>
                  {r.is_favorite && <Heart size={13} strokeWidth={2.75} fill="currentColor" color="var(--color-accent)" aria-label="Favorit" style={{ display: 'inline', marginRight: 5, verticalAlign: '-1px' }} />}{r.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{sourceLabel(r)}{by(r)}</div>
                <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                  {r.tagIds.map(tagById).filter((t) => !!t).map((t) => <TagPill key={t.id} tag={t} />)}
                </div>
              </div>
              <div className="col" style={{ flex: 'none', alignItems: 'flex-end', gap: 3 }}>
                <EffortIcons n={r.effort} size={12} />
                <span style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{EFFORT[r.effort]}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showTags && <TagsSheet onClose={() => setShowTags(false)} onPick={(id) => set({ chip: id })} />}

      {showFilter && (
        <Sheet onClose={() => setShowFilter(false)} style={{ gap: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>Filtrera</h3>
            <button className="btn btn-ghost" onClick={() => set({ eff: [], src: 'alla', tagSel: [], sort: 'new', by: null })} style={{ color: 'var(--color-accent-700)' }}>Rensa</button>
          </div>
          <div className="col" style={{ gap: 8 }}>
            <span className="label">Insats</span>
            <EffortPicker value={f.eff} onChange={(x) => set({ eff: toggle(f.eff, x) })} height={56} radius={20} iconSize={18} fontSize={12} />
          </div>
          <div className="col" style={{ gap: 8 }}>
            <span className="label">Källa</span>
            <div className="seg2" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              {([['alla', 'Alla'], ['web', 'Webb'], ['book', 'Kokbok']] as const).map(([k, label]) => (
                <button key={k} className={f.src === k ? 'on' : ''} onClick={() => set({ src: k })} style={{ height: 38, boxShadow: 'none' }}>{label}</button>
              ))}
            </div>
          </div>
          <div className="col" style={{ gap: 8 }}>
            <span className="label">Taggar</span>
            <div className="wrap">{tags.map((t) => <button key={t.id} className={'chip' + (f.tagSel.includes(t.id) ? ' on' : '')} onClick={() => set({ tagSel: toggle(f.tagSel, t.id) })}>{t.name}</button>)}</div>
          </div>
          <div className="col" style={{ gap: 8 }}>
            <span className="label">Sortera</span>
            <div className="wrap">
              {([['new', 'Senast sparade'], ['low', 'Minst insats'], ['high', 'Mest insats']] as const).map(([k, label]) => (
                <button key={k} className={'chip' + (f.sort === k ? ' on' : '')} onClick={() => set({ sort: k })}>{label}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setShowFilter(false)} style={{ height: 52, fontSize: 16 }}>{items.length === 1 ? 'Visa 1 recept' : `Visa ${items.length} recept`}</button>
        </Sheet>
      )}
    </div>
  );
}

function FavBadge({ style }: { style?: CSSProperties }) {
  return (
    <span aria-label="Favorit" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-bg)', color: 'var(--color-accent)', display: 'grid', placeItems: 'center', ...style }}>
      <Heart size={15} strokeWidth={2.75} fill="currentColor" aria-hidden style={{ display: 'block' }} />
    </span>
  );
}
