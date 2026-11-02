import { useNavigate } from 'react-router-dom';
import { Camera, Link, PencilLine } from 'lucide-react';
import { Ico, Sheet } from '../components/ui';

export function AddSheet({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const go = (to: string) => { onClose(); nav(to); };
  const row = { display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 28, cursor: 'pointer', textAlign: 'left' } as const;
  const dot = (bg: string) => ({ flex: 'none', width: 48, height: 48, borderRadius: '50%', background: bg, display: 'grid', placeItems: 'center' } as const);
  return (
    <Sheet onClose={onClose} style={{ gap: 12, paddingBottom: 26 }}>
      <h3 style={{ marginBottom: 4 }}>Lägg till recept</h3>
      <button onClick={() => go('/ny/lank')} style={{ ...row, border: 0, background: 'var(--color-accent-2-100)', color: 'var(--color-accent-2-900)' }}>
        <span style={dot('var(--color-accent-2-600)')}><Ico icon={Link} size={22} color="var(--color-bg)" /></span>
        <span className="col"><span style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>Från en länk</span><span style={{ fontSize: 13 }}>Vi hämtar receptet från sidan</span></span>
      </button>
      <button onClick={() => go('/ny/kokbok')} style={{ ...row, border: 0, background: 'var(--color-accent-100)', color: 'var(--color-accent-900)' }}>
        <span style={dot('var(--color-accent)')}><Ico icon={Camera} size={22} color="var(--color-bg)" /></span>
        <span className="col"><span style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>Från en kokbokssida</span><span style={{ fontSize: 13 }}>Kopiera texten med kameran</span></span>
      </button>
      <button onClick={() => go('/ny/bok')} style={{ ...row, border: '1.5px solid var(--color-divider)', background: 'transparent', color: 'var(--color-text)' }}>
        <span style={dot('var(--color-surface)')}><Ico icon={PencilLine} size={22} color="var(--color-neutral-800)" /></span>
        <span className="col"><span style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>Skriv in själv</span><span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Ingredienser och steg, bok och sida om du vill</span></span>
      </button>
    </Sheet>
  );
}
