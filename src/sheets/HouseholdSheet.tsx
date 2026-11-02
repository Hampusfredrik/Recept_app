import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Sheet, useToast } from '../components/ui';

// Inbjudan och utloggning. Inte ritat i designen; följer arkens formspråk.
export function HouseholdSheet({ onClose }: { onClose: () => void }) {
  const { household, households, selectHousehold, session, rotateInvite, renameHousehold, joinHousehold, leaveHousehold, signOut, members, setMyName } = useStore();
  const myName = members.find((m) => m.user_id === session?.user.id)?.display_name ?? '';
  const [me, setMe] = useState(myName);
  useEffect(() => { setMe(myName); }, [myName]);
  const meDirty = me.trim() !== myName;
  const saveMe = async () => {
    if (!meDirty) return;
    setBusy(true);
    try { await setMyName(me); toast('Ditt namn är sparat'); } catch (e) { toast(e instanceof Error ? e.message : 'Kunde inte spara namnet'); }
    setBusy(false);
  };
  const others = members.filter((m) => m.user_id !== session?.user.id);
  const toast = useToast();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(household?.name ?? '');
  const [code, setCode] = useState('');
  const [joinErr, setJoinErr] = useState('');
  if (!household) return null;
  const join = async () => {
    if (!code.trim()) return;
    setBusy(true); setJoinErr('');
    try {
      await joinHousehold(code);
      toast('Du har gått med i köket');
      onClose();
    } catch (e) {
      setJoinErr(e instanceof Error && /okänd/i.test(e.message) ? 'Koden finns inte. Kontrollera den och försök igen.' : 'Kunde inte gå med i köket.');
    }
    setBusy(false);
  };
  const leave = async () => {
    if (!confirm(
      `Lämna ”${household.name}”?\n\nDu slutar se kökets recept, vecka och anteckningar. Andra medlemmar påverkas inte. Är du ensam i köket går det inte att komma tillbaka till det.`,
    )) return;
    setBusy(true);
    try { await leaveHousehold(); toast('Du har lämnat köket'); onClose(); } catch { toast('Kunde inte lämna köket'); setBusy(false); }
  };
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
      <div className="field">
        <label>Ditt namn</label>
        <div className="row" style={{ gap: 8 }}>
          <input className="input big" value={me} maxLength={40} onChange={(e) => setMe(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveMe()} placeholder="Visas på recepten du lägger in" />
          {meDirty && <button className="btn btn-primary" disabled={busy} onClick={saveMe} style={{ flex: 'none', height: 48, padding: '0 18px' }}>Spara</button>}
        </div>
        {others.length > 0 && <span style={{ display: 'block', marginTop: 6, fontSize: 13, color: 'var(--color-neutral-700)' }}>
          Också i köket: {others.map((m) => m.display_name ?? 'namn saknas').join(', ')}
        </span>}
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
      {households.length > 1 && (
        <div className="col" style={{ gap: 6 }}>
          <span className="label">Du är med i {households.length} kök</span>
          {households.map((h) => {
            const on = h.id === household.id;
            return (
              <button key={h.id} disabled={on} onClick={() => { selectHousehold(h.id); setName(h.name); onClose(); }} className="row hover-surface"
                style={{ justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderRadius: 18, border: `1.5px solid ${on ? 'var(--color-accent)' : 'var(--color-divider)'}`, background: 'transparent', cursor: on ? 'default' : 'pointer', textAlign: 'left', font: '600 14px var(--font-body)', color: 'var(--color-text)' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                <span style={{ flex: 'none', fontSize: 12, fontWeight: 400, color: 'var(--color-neutral-700)' }}>
                  {on ? 'Valt' : h.recipeCount != null ? `${h.recipeCount} recept` : 'Byt hit'}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="field">
        <label>Gå med i ett annat kök</label>
        <div className="row" style={{ gap: 8 }}>
          <input className="input big" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setJoinErr(''); }} onKeyDown={(e) => e.key === 'Enter' && join()}
            placeholder="Inbjudningskod" autoCapitalize="characters" style={{ letterSpacing: '.08em' }} />
          <button className="btn btn-secondary" disabled={busy || !code.trim()} onClick={join} style={{ flex: 'none', height: 48, padding: '0 18px' }}>Gå med</button>
        </div>
        {joinErr && <span className="err" style={{ display: 'block', marginTop: 6 }}>{joinErr}</span>}
      </div>
      <button className="btn btn-secondary" onClick={() => { onClose(); nav('/feedback'); }} style={{ alignSelf: 'flex-start', height: 44, padding: '0 16px' }}>Feedback och förslag till appen</button>
      <div className="row" style={{ justifyContent: 'space-between', gap: 10, fontSize: 13, color: 'var(--color-neutral-700)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Inloggad som {session?.user.email}</span>
        <button className="btn btn-ghost" onClick={async () => { onClose(); await signOut(); }} style={{ color: 'var(--color-accent-700)', flex: 'none' }}>Logga ut</button>
      </div>
      <button className="btn btn-ghost" disabled={busy} onClick={leave} style={{ alignSelf: 'flex-start', color: 'var(--color-neutral-700)', marginTop: -10 }}>Lämna köket</button>
    </Sheet>
  );
}
