import { useState } from 'react';
import { useStore } from '../lib/store';
import { Sheet, useToast } from '../components/ui';

// Inbjudan och utloggning. Inte ritat i designen; följer arkens formspråk.
export function HouseholdSheet({ onClose }: { onClose: () => void }) {
  const { household, session, rotateInvite, renameHousehold, signOut } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(household?.name ?? '');
  if (!household) return null;
  const dirty = name.trim() !== household.name;
  const saveName = async () => {
    if (!dirty) return;
    setBusy(true);
    try { await renameHousehold(name); toast('Köket har bytt namn'); } catch { toast('Kunde inte spara namnet'); }
    setBusy(false);
  };
  const link = `${window.location.origin}${import.meta.env.BASE_URL}#/join/${household.invite_code}`;

  const share = async () => {
    const text = `Gå med i vårt kök i Receptappen: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Receptappen', text, url: link }); return; } catch { /* avbrutet */ }
    }
    try { await navigator.clipboard.writeText(link); toast('Länken är kopierad'); } catch { /* ingen åtkomst */ }
  };

  return (
    <Sheet onClose={onClose}>
      <h3>Ert kök</h3>
      <div className="field" style={{ marginTop: -6 }}>
        <label>Namn på köket</label>
        <div className="row" style={{ gap: 8 }}>
          <input className="input big" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} placeholder="t.ex. Hemma hos oss" />
          {dirty && <button className="btn btn-primary" disabled={busy} onClick={saveName} style={{ flex: 'none', height: 48, padding: '0 18px' }}>Spara</button>}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>Bjud in den du lagar mat med. Ni ser samma recept, vecka och anteckningar direkt.</p>
      <div className="col" style={{ gap: 4, padding: '14px 18px', borderRadius: 24, background: 'var(--color-surface)' }}>
        <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', fontWeight: 600 }}>Inbjudningskod</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 28, letterSpacing: '.08em' }}>{household.invite_code}</span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary" onClick={share} style={{ height: 52, flex: 1, fontSize: 16 }}>Dela inbjudan</button>
        <button className="btn btn-secondary" disabled={busy} onClick={async () => { setBusy(true); await rotateInvite(); setBusy(false); }} style={{ height: 52, flex: 'none', padding: '0 16px', fontSize: 15 }}>Ny kod</button>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', gap: 10, fontSize: 13, color: 'var(--color-neutral-700)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Inloggad som {session?.user.email}</span>
        <button className="btn btn-ghost" onClick={async () => { onClose(); await signOut(); }} style={{ color: 'var(--color-accent-700)', flex: 'none' }}>Logga ut</button>
      </div>
    </Sheet>
  );
}
