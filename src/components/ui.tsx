import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, Flame, Minus, Plus, X, type LucideIcon } from 'lucide-react';
import { EFFORT, stripe } from '../lib/format';
import type { Tag } from '../lib/types';
import { TONES } from '../lib/format';

export const SW = 2.75;

export function Ico({ icon: I, size = 18, color, style }: { icon: LucideIcon; size?: number; color?: string; style?: CSSProperties }) {
  return <I size={size} strokeWidth={SW} color={color ?? 'currentColor'} style={{ display: 'block', flex: 'none', ...style }} aria-hidden />;
}

const ON = 'var(--color-accent)';
const OFF = 'var(--color-neutral-300)';

export function EffortIcons({ n, size = 12, gap = 1, on = ON, off = OFF }: { n: number; size?: number; gap?: number; on?: string; off?: string }) {
  return (
    <span style={{ display: 'flex', gap }} aria-label={`Insats ${n} av 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Ico key={i} icon={Flame} size={size} color={i <= n ? on : off} />)}
    </span>
  );
}

/** Fem knappar 1–5. Enkelval (number) eller flerval (number[]). */
export function EffortPicker({ value, onChange, height = 62, radius = 22, iconSize = 20, fontSize = 13 }: {
  value: number | number[]; onChange: (n: number) => void; height?: number; radius?: number; iconSize?: number; fontSize?: number;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = Array.isArray(value) ? value.includes(n) : value === n;
        return (
          <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={on} aria-label={`${n} · ${EFFORT[n]}`}
            style={{ height, borderRadius: radius, cursor: 'pointer', border: `1.5px solid ${on ? 'var(--color-accent)' : 'var(--color-divider)'}`,
              background: on ? 'var(--color-accent)' : 'transparent', color: on ? 'var(--color-bg)' : 'var(--color-neutral-800)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <Ico icon={Flame} size={iconSize} />
            <span style={{ font: `700 ${fontSize}px var(--font-body)` }}>{n}</span>
          </button>
        );
      })}
    </div>
  );
}

export function EffortField({ value, onChange, error }: { value: number; onChange: (n: number) => void; error: boolean }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Insats · <b style={{ color: 'var(--color-text)' }}>{value ? `${value}/5 · ${EFFORT[value]}` : 'välj 1–5'}</b></span>
      <EffortPicker value={value} onChange={onChange} />
      {error && !value && <span className="err">Välj hur mycket insats receptet kräver.</span>}
    </div>
  );
}

export function TagChooser({ tags, selected, onToggle, label = 'Taggar' }: { tags: Tag[]; selected: string[]; onToggle: (id: string) => void; label?: string }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{label}</span>
      <div className="wrap">
        {tags.map((t) => {
          const on = selected.includes(t.id);
          return <button key={t.id} type="button" className={'chip' + (on ? ' on' : '')} onClick={() => onToggle(t.id)}>{on ? '✓ ' : ''}{t.name}</button>;
        })}
      </div>
    </div>
  );
}

export function TagPill({ tag, style }: { tag: Tag; style?: CSSProperties }) {
  const t = TONES[tag.tone];
  return <span className="tag" style={{ background: t.bg, color: t.fg, padding: '1px 8px', ...style }}>{tag.name}</span>;
}

/** Bild om den finns, annars randig platshållare i receptets ton. */
export function Thumb({ id, image, size, radius, stripeW = 6, style, onClick }: {
  id: string; image?: string | null; size?: number; radius: number | string; stripeW?: number; style?: CSSProperties; onClick?: () => void;
}) {
  return (
    <div className="thumb" onClick={onClick}
      style={{ width: size, height: size, borderRadius: radius, background: stripe(id, stripeW), cursor: onClick ? 'pointer' : undefined,
        ...(image ? { backgroundImage: `url("${image}")` } : {}), backgroundSize: 'cover', backgroundPosition: 'center', ...style }} />
  );
}

export function TopBar({ onClose, title, icon = 'x', dark }: { onClose: () => void; title?: string; icon?: 'x' | 'back'; dark?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 22 }}>
      <button className="circle-btn" onClick={onClose} aria-label={icon === 'x' ? 'Stäng' : 'Tillbaka'}
        style={dark ? { background: 'var(--color-neutral-800)', color: 'var(--color-neutral-100)' } : undefined}>
        <Ico icon={icon === 'x' ? X : ChevronLeft} size={icon === 'x' ? 18 : 20} />
      </button>
      {title && <span style={{ fontWeight: 700, fontSize: 14, color: dark ? undefined : 'var(--color-neutral-700)' }}>{title}</span>}
      <span style={{ width: 44 }} />
    </div>
  );
}

export function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const btn: CSSProperties = { width: 34, height: 34, border: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' };
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>{label}</span>
      <div className="row" style={{ gap: 4, padding: 3, borderRadius: 999, border: '1.5px solid var(--color-divider)' }}>
        <button className="hover-surface" style={btn} onClick={() => onChange(Math.max(1, value - 1))} aria-label="Färre"><Ico icon={Minus} size={14} /></button>
        <span style={{ minWidth: 72, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{value === 1 ? '1 portion' : `${value} portioner`}</span>
        <button className="hover-surface" style={btn} onClick={() => onChange(Math.min(20, value + 1))} aria-label="Fler"><Ico icon={Plus} size={14} /></button>
      </div>
    </div>
  );
}

export function Sheet({ onClose, children, style, className }: { onClose: () => void; children: ReactNode; style?: CSSProperties; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Direkt i <body>, så att arket hamnar överst även när det öppnas inifrån en yta med egen z-index.
  return createPortal(
    <>
      <div className="backdrop" onClick={onClose} />
      <div className={'sheet' + (className ? ' ' + className : '')} role="dialog" aria-modal="true" style={style}>{children}</div>
    </>,
    document.body,
  );
}

export function Spinner({ size = 20, border = 3 }: { size?: number; border?: number }) {
  return <span className="spinner" style={{ width: size, height: size, borderWidth: border }} />;
}

// ── Toast ──
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [k, setK] = useState(0);
  const t = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m); setK((x) => x + 1);
    clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(''), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div key={k} className="toast" role="status"><Ico icon={Check} size={16} color="var(--color-accent-2-300)" />{msg}</div>}
    </ToastCtx.Provider>
  );
}

export function WeekToggle({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="seg2" style={{ gridTemplateColumns: '1fr 1fr' }}>
      {['Den här veckan', 'Nästa vecka'].map((label, i) => (
        <button key={label} className={value === i ? 'on' : ''} onClick={() => onChange(i)} aria-pressed={value === i} style={{ height: 38 }}>{label}</button>
      ))}
    </div>
  );
}
