import { useState } from 'react';
import { ChefHat, Lock, Mail } from 'lucide-react';
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
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  // Lösenord i stället för e-postlänk: en PWA på iPhones hemskärm delar inte
  // lagring med Safari, så en länk i mejlet loggar inte in hemskärmsappen.
  const submit = async () => {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setErr('Skriv en giltig e-postadress.');
    if (password.length < 6) return setErr('Lösenordet behöver minst 6 tecken.');
    setBusy(true); setErr(''); setInfo('');
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) setErr(/confirm/i.test(error.message) ? 'Bekräfta först din e-post via länken i mejlet.' : 'Fel e-post eller lösenord.');
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: e, password, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
      });
      if (error) setErr(error.message);
      else if (!data.session) {
        setInfo('Kontot är skapat. Öppna länken i mejlet för att bekräfta din e-post, kom sedan tillbaka hit och logga in.');
        setMode('login');
      }
    }
    setBusy(false);
  };

  const field = { flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, outline: 'none', color: 'var(--color-text)' } as const;
  const pill = { gap: 10, height: 54, padding: '0 18px', borderRadius: 999, background: 'var(--color-surface)' } as const;

  return (
    <div className="screen no-tabs col" style={{ gap: 18 }}>
      <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-accent)', display: 'grid', placeItems: 'center', color: 'var(--color-bg)' }}>
        <Ico icon={ChefHat} size={30} />
      </span>
      <div className="col" style={{ gap: 2 }}>
        <span className="kicker">Receptappen</span>
        <h1 className="h1">{mode === 'login' ? 'Logga in' : 'Skapa konto'}</h1>
      </div>
      {info && <div style={{ padding: '12px 16px', borderRadius: 22, background: 'var(--color-accent-2-100)', color: 'var(--color-accent-2-900)', fontSize: 14 }}>{info}</div>}
      <label className="row" style={pill}>
        <Ico icon={Mail} size={18} color="var(--color-neutral-700)" />
        <input type="email" autoComplete="email" inputMode="email" autoCapitalize="off" value={email}
          onChange={(e) => { setEmail(e.target.value); setErr(''); }} placeholder="din@epost.se" style={field} />
      </label>
      <label className="row" style={pill}>
        <Ico icon={Lock} size={18} color="var(--color-neutral-700)" />
        <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password}
          onChange={(e) => { setPassword(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Lösenord" style={field} />
      </label>
      {err && <span className="err" style={{ marginLeft: 18 }}>{err}</span>}
      <button className="btn btn-primary btn-block" onClick={submit} disabled={busy} style={{ height: 54, fontSize: 17 }}>
        {busy ? <Spinner /> : mode === 'login' ? 'Logga in' : 'Skapa konto'}
      </button>
      <button className="btn btn-ghost" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErr(''); setInfo(''); }}
        style={{ alignSelf: 'flex-start', color: 'var(--color-accent-700)' }}>
        {mode === 'login' ? 'Inget konto än? Skapa ett' : 'Har du redan ett konto? Logga in'}
      </button>
    </div>
  );
}

export function Onboarding() {
  const { createHousehold, joinHousehold, signOut, error: loadErr } = useStore();
  const [code, setCode] = useState(localStorage.getItem('receptappen.invite.failed') ?? '');
  const [name, setName] = useState('');
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
      <div className="field"><label>Namn på köket</label>
        <input className="input big" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Hemma hos oss" />
      </div>
      <button className="btn btn-primary btn-block" disabled={busy} onClick={() => run(() => createHousehold(name.trim() || undefined))} style={{ height: 54, fontSize: 17, marginTop: -4 }}>Skapa ett kök</button>
      <div className="col" style={{ gap: 8, marginTop: 10 }}>
        <span className="label">Har du en kod?</span>
        <div className="row" style={{ gap: 8 }}>
          <input className="input big" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="T.ex. 4F2A9C1B" style={{ letterSpacing: '.1em' }} />
          <button className="btn btn-secondary" disabled={busy || !code.trim()} onClick={() => run(() => joinHousehold(code))} style={{ height: 48, flex: 'none', padding: '0 18px' }}>Gå med</button>
        </div>
      </div>
      {(err || loadErr) && <span className="err">{err || loadErr}</span>}
      <button className="btn btn-ghost" onClick={signOut} style={{ alignSelf: 'flex-start', color: 'var(--color-accent-700)' }}>Logga ut</button>
    </div>
  );
}
