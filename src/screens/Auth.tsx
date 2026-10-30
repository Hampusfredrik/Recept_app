import { useState } from 'react';
import { ChefHat, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { Ico, Spinner } from '../components/ui';

// Inloggning och kök är inte ritade i designen; de följer samma formspråk.

export function NotConfigured() {
  return (
    <div className="screen no-tabs col" style={{ gap: 12 }}>
      <span className="kicker">Receptappen</span>
      <h1 className="h1">Saknar Supabase</h1>
      <p className="muted" style={{ margin: 0 }}>Sätt <code>VITE_SUPABASE_URL</code> och <code>VITE_SUPABASE_ANON_KEY</code> (se README) och bygg om appen.</p>
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Skriv en giltig e-postadress.');
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setSent(true);
  };

  const verify = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setErr('Koden stämmer inte eller har gått ut.');
  };

  return (
    <div className="screen no-tabs col" style={{ gap: 18 }}>
      <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-accent)', display: 'grid', placeItems: 'center', color: 'var(--color-bg)' }}>
        <Ico icon={ChefHat} size={30} />
      </span>
      <div className="col" style={{ gap: 2 }}>
        <span className="kicker">Receptappen</span>
        <h1 className="h1">{sent ? 'Kolla mejlen' : 'Logga in'}</h1>
      </div>
      {!sent ? (
        <>
          <p className="muted" style={{ margin: 0 }}>Vi skickar en inloggningslänk. Inget lösenord behövs.</p>
          <label className="row" style={{ gap: 10, height: 54, padding: '0 18px', borderRadius: 999, background: 'var(--color-surface)' }}>
            <Ico icon={Mail} size={18} color="var(--color-neutral-700)" />
            <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="din@epost.se"
              style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, outline: 'none', color: 'var(--color-text)' }} />
          </label>
          {err && <span className="err" style={{ marginLeft: 18 }}>{err}</span>}
          <button className="btn btn-primary btn-block" onClick={send} disabled={busy} style={{ height: 54, fontSize: 17 }}>{busy ? <Spinner /> : 'Skicka länk'}</button>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: 0 }}>Öppna länken vi skickade till <b>{email}</b>. Använder du appen från hemskärmen: skriv in koden från mejlet här i stället.</p>
          <input className="input big" inputMode="numeric" autoComplete="one-time-code" value={code} placeholder="Kod från mejlet"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))} onKeyDown={(e) => e.key === 'Enter' && verify()}
            style={{ textAlign: 'center', letterSpacing: '.2em' }} />
          {err && <span className="err">{err}</span>}
          <button className="btn btn-primary btn-block" onClick={verify} disabled={busy || code.length < 6} style={{ height: 54, fontSize: 17 }}>{busy ? <Spinner /> : 'Logga in'}</button>
          <button className="btn btn-ghost" onClick={() => { setSent(false); setCode(''); }} style={{ alignSelf: 'flex-start', color: 'var(--color-accent-700)' }}>Byt e-postadress</button>
        </>
      )}
    </div>
  );
}

export function Onboarding() {
  const { createHousehold, joinHousehold, signOut } = useStore();
  const [code, setCode] = useState(localStorage.getItem('receptappen.invite.failed') ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); localStorage.removeItem('receptappen.invite.failed'); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  return (
    <div className="screen no-tabs col" style={{ gap: 18 }}>
      <div className="col" style={{ gap: 2 }}>
        <span className="kicker">Välkommen</span>
        <h1 className="h1">Ert kök</h1>
      </div>
      <p className="muted" style={{ margin: 0 }}>Recepten delas i ett kök. Skapa ett nytt, eller gå med i ditt sällskaps kök med deras kod.</p>
      <button className="btn btn-primary btn-block" disabled={busy} onClick={() => run(() => createHousehold())} style={{ height: 54, fontSize: 17 }}>Skapa ett kök</button>
      <div className="col" style={{ gap: 8, marginTop: 10 }}>
        <span className="label">Har du en kod?</span>
        <div className="row" style={{ gap: 8 }}>
          <input className="input big" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="T.ex. 4F2A9C1B" style={{ letterSpacing: '.1em' }} />
          <button className="btn btn-secondary" disabled={busy || !code.trim()} onClick={() => run(() => joinHousehold(code))} style={{ height: 48, flex: 'none', padding: '0 18px' }}>Gå med</button>
        </div>
      </div>
      {err && <span className="err">{err}</span>}
      <button className="btn btn-ghost" onClick={signOut} style={{ alignSelf: 'flex-start', color: 'var(--color-accent-700)' }}>Logga ut</button>
    </div>
  );
}
