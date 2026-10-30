import { NavLink } from 'react-router-dom';
import { BookMarked, CalendarDays, House, Plus, Tag } from 'lucide-react';
import { Ico } from './ui';
import { useUi } from './uiState';

export function TabBar() {
  const { setSheet } = useUi();
  const tab = (to: string, icon: typeof House, label: string) => (
    <NavLink to={to} end className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
      <Ico icon={icon} size={20} />{label}
    </NavLink>
  );
  return (
    <nav className="tabbar" aria-label="Huvudmeny">
      {tab('/', House, 'Idag')}
      {tab('/recept', BookMarked, 'Recept')}
      <button className="plus" onClick={() => setSheet({ kind: 'add' })} aria-label="Lägg till recept"><Ico icon={Plus} size={24} /></button>
      {tab('/veckan', CalendarDays, 'Veckan')}
      {tab('/taggar', Tag, 'Taggar')}
    </nav>
  );
}
