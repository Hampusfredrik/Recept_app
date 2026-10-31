// Datum hanteras som lokala YYYY-MM-DD-strängar.
export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function daysSince(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const a = fromIso(dateIso), b = fromIso(today());
  return Math.round((b.getTime() - a.getTime()) / 864e5);
}

export const WEEKDAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
export const WEEKDAYS_SHORT = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
export const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
export const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** 0 = måndag */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

export function mondayOf(d: Date) { return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -weekdayIndex(d)); }

/** offset 0 = den här veckan, 1 = nästa vecka */
export const weekAt = (offset: number) => weekDates(addDays(new Date(), 7 * offset));

export function weekDates(ref = new Date()): Date[] {
  const m = mondayOf(ref);
  return Array.from({ length: 7 }, (_, i) => addDays(m, i));
}

/** ISO 8601-veckonummer */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 864e5 + 1) / 7);
}

export const todayKicker = (d = new Date()) => `${WEEKDAYS[weekdayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const shortDate = (s: string) => { const d = new Date(s); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };

export function lastLabel(days: number | null): string {
  if (days == null) return 'Aldrig lagad';
  if (days <= 0) return 'Lagad idag';
  if (days === 1) return 'Lagad igår';
  if (days < 14) return `Lagad för ${days} dagar sedan`;
  if (days < 60) return `Lagad för ${Math.round(days / 7)} veckor sedan`;
  return `Lagad för ${Math.round(days / 30)} månader sedan`;
}
