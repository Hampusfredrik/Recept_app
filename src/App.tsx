import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { configured } from './lib/supabase';
import { ToastProvider, Spinner } from './components/ui';
import { UiProvider } from './components/uiState';
import { TabBar } from './components/TabBar';
import { Login, Onboarding, NotConfigured } from './screens/Auth';
import { Home } from './screens/Home';
import { Library } from './screens/Library';
import { Week } from './screens/Week';
import { Tags } from './screens/Tags';
import { Pantry } from './screens/Pantry';
import { Detail } from './screens/Detail';
import { AddLink } from './screens/AddLink';
import { AddBook } from './screens/AddBook';
import { Scan } from './screens/Scan';

const INVITE_KEY = 'receptappen.invite';

function JoinRoute() {
  const { code } = useParams();
  useEffect(() => { if (code) localStorage.setItem(INVITE_KEY, code); }, [code]);
  return <Navigate to="/" replace />;
}

function Loading() {
  return <div className="screen" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}><Spinner size={28} border={4} /></div>;
}

function Gate() {
  const s = useStore();
  const loc = useLocation();
  const nav = useNavigate();

  // Inbjudan som öppnades före inloggning: gå med automatiskt.
  useEffect(() => {
    const code = localStorage.getItem(INVITE_KEY);
    if (!s.session || s.householdLoading || !code) return;
    localStorage.removeItem(INVITE_KEY);
    s.joinHousehold(code).then(() => nav('/')).catch(() => localStorage.setItem(INVITE_KEY + '.failed', code));
  }, [s.session, s.householdLoading]);

  if (loc.pathname.startsWith('/join/')) return <Routes><Route path="/join/:code" element={<JoinRoute />} /></Routes>;
  if (!s.authReady) return <Loading />;
  if (!s.session) return <Login />;
  if (s.householdLoading) return <Loading />;
  if (!s.household) return <Onboarding />;
  if (!s.loaded) return <Loading />;

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recept" element={<Library />} />
        <Route path="/recept/:id" element={<Detail />} />
        <Route path="/veckan" element={<Week />} />
        <Route path="/taggar" element={<Tags />} />
        <Route path="/laga" element={<Pantry />} />
        <Route path="/ny/lank" element={<AddLink />} />
        <Route path="/ny/bok" element={<AddBook />} />
        <Route path="/ny/kokbok" element={<Scan />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {['/', '/recept', '/veckan', '/taggar'].includes(loc.pathname) && <TabBar />}
    </>
  );
}

export default function App() {
  if (!configured) return <NotConfigured />;
  return (
    <HashRouter>
      <ToastProvider>
        <StoreProvider>
          <UiProvider>
            <Gate />
          </UiProvider>
        </StoreProvider>
      </ToastProvider>
    </HashRouter>
  );
}
