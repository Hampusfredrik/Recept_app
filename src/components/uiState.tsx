import { createContext, useContext, useState, type ReactNode } from 'react';
import { emptyFilter, type LibFilter } from '../lib/logic';
import { AddSheet } from '../sheets/AddSheet';
import { RandomSheet } from '../sheets/RandomSheet';
import { PickSheet } from '../sheets/PickSheet';
import { HouseholdSheet } from '../sheets/HouseholdSheet';

export type SheetState =
  | { kind: 'add' }
  | { kind: 'random'; pickDate?: string }
  | { kind: 'pick'; date: string }
  | { kind: 'household' }
  | null;

interface Ui {
  filter: LibFilter;
  setFilter: (f: LibFilter | ((f: LibFilter) => LibFilter)) => void;
  view: 'grid' | 'list';
  setView: (v: 'grid' | 'list') => void;
  weekOffset: number;
  setWeekOffset: (n: number) => void;
  sheet: SheetState;
  setSheet: (s: SheetState) => void;
}

const Ctx = createContext<Ui | null>(null);
export const useUi = () => useContext(Ctx)!;

export function UiProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<LibFilter>(emptyFilter);
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const close = () => setSheet(null);
  return (
    <Ctx.Provider value={{ filter, setFilter, view, setView, weekOffset, setWeekOffset, sheet, setSheet }}>
      {children}
      {sheet?.kind === 'add' && <AddSheet onClose={close} />}
      {sheet?.kind === 'random' && <RandomSheet pickDate={sheet.pickDate} onClose={close} />}
      {sheet?.kind === 'pick' && <PickSheet date={sheet.date} onClose={close} />}
      {sheet?.kind === 'household' && <HouseholdSheet onClose={close} />}
    </Ctx.Provider>
  );
}
