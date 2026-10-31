import { Link, NavLink } from 'react-router-dom';
import { BookMarked, CalendarDays, ChefHat, House, Plus, Tag } from 'lucide-react';
import { Ico } from './ui';
import { useUi } from './uiState';

/** Flikrad längst ner på mobil, sidomeny till vänster på dator (se app.css). */
export function TabBar({ desktopOnly = false }: { desktopOnly?: boolean }) {
  const { setSheet } = useUi();
  const tab = (to: string, icon: typeof House, label: string) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
      <Ico icon={icon} size={20} /><span>{label}</span>
    </NavLink>
  );
  return (
    <nav className={'tabbar' + (desktopOnly ? ' desktop-only' : '')} aria-label="Huvudmeny">
      <Link to="/" className="brand" aria-label="Receptappen, till startsidan"><Ico icon={ChefHat} size={22} />Receptappen</Link>
      {tab('/', House, 'Idag')}
      {tab('/recept', BookMarked, 'Recept')}
      <button className="plus" onClick={() => setSheet({ kind: 'add' })} aria-label="Lägg till recept">
        <Ico icon={Plus} size={24} /><span className="plus-label">Lägg till recept</span>
      </button>
      {tab('/veckan', CalendarDays, 'Veckan')}
      {tab('/taggar', Tag, 'Taggar')}
    </nav>
  );
}
