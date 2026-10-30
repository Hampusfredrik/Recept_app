import type { Recipe, Tone } from './types';

export const EFFORT = ['', 'Superlätt', 'Lätt', 'Medel', 'Lite mer att göra', 'Helgprojekt'];
export const TONE_ORDER: Tone[] = ['accent', 'sage', 'sand', 'clay'];

export const TONES: Record<Tone, { bg: string; fg: string; dot: string; s1: string; s2: string }> = {
  accent: { bg: 'var(--color-accent-100)', fg: 'var(--color-accent-800)', dot: 'var(--color-accent)', s1: 'var(--color-accent-200)', s2: 'var(--color-accent-100)' },
  sage: { bg: 'var(--color-accent-2-100)', fg: 'var(--color-accent-2-800)', dot: 'var(--color-accent-2)', s1: 'var(--color-accent-2-200)', s2: 'var(--color-accent-2-100)' },
  sand: { bg: 'var(--color-neutral-200)', fg: 'var(--color-neutral-800)', dot: 'var(--color-neutral-600)', s1: 'var(--color-neutral-300)', s2: 'var(--color-neutral-200)' },
  clay: { bg: 'var(--color-accent-200)', fg: 'var(--color-accent-900)', dot: 'var(--color-accent-700)', s1: 'var(--color-accent-300)', s2: 'var(--color-accent-200)' },
};

/** Stabil ton per recept för platshållarbilden. */
export function recipeTone(id: string): Tone {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return TONE_ORDER[Math.abs(h) % 4];
}

export function stripe(id: string, a: number) {
  const t = TONES[recipeTone(id)];
  return `repeating-linear-gradient(135deg, ${t.s1} 0 ${a}px, ${t.s2} ${a}px ${a * 2}px)`;
}

export function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  const v = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return String(v).replace('.', ',');
}

export function domainOf(u: string): string {
  try { return new URL(/^https?:\/\//.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, ''); } catch { return 'webbsidan'; }
}

export function sourceLabel(r: Recipe) {
  return r.source_type === 'web' ? (r.domain || domainOf(r.url || '')) : `${r.book_title ?? ''}${r.page ? ` s. ${r.page}` : ''}`;
}

export const amountLabel = (amount: number | null, unit: string, scale = 1) =>
  amount == null ? '' : `${fmt(amount * scale)}${unit ? ' ' + unit : ''}`;
