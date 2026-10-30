// Ren TypeScript utan Deno- eller webbläsar-API:er. Importeras både av
// Edge-funktionen (Deno) och av frontend (Vite) så att reglerna är identiska.

export const UNITS = ['g', 'kg', 'dl', 'l', 'ml', 'cl', 'msk', 'tsk', 'krm', 'st', 'burk', 'paket', 'kruka'];
const UNIT_RE = UNITS.join('|');

export interface ParsedIngredient {
  amount: number | null;
  unit: string;
  name: string;
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (FRACTIONS[s] != null) return FRACTIONS[s];
  // "1½" eller "1 ½"
  const mixed = s.match(/^(\d+)\s*([½¼¾⅓⅔])$/);
  if (mixed) return parseInt(mixed[1], 10) + FRACTIONS[mixed[2]];
  // "1/2"
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
  // "2-3" → första värdet
  const range = s.match(/^([\d.,]+)\s*[-–]\s*[\d.,]+$/);
  if (range) return parseAmount(range[1]);
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const AMOUNT_RE = '(\\d+\\s*[½¼¾⅓⅔]|[½¼¾⅓⅔]|\\d+\\/\\d+|[\\d.,]+(?:\\s*[-–]\\s*[\\d.,]+)?)';
const INGR_LINE = new RegExp(`^${AMOUNT_RE}\\s*(${UNIT_RE})?\\.?\\s+(.+)$`, 'i');

/** "400 g torskfilé" → { amount: 400, unit: 'g', name: 'torskfilé' } */
export function parseIngredientLine(line: string): ParsedIngredient {
  const t = line.trim().replace(/\s+/g, ' ');
  const m = t.match(INGR_LINE);
  if (!m) return { amount: null, unit: '', name: t };
  return { amount: parseAmount(m[1]), unit: (m[2] || '').toLowerCase(), name: m[3].trim() };
}

/** Ser raden ut som en ingrediens enligt reglerna i handoffen? */
export function looksLikeIngredient(line: string): boolean {
  // "1. Skär …" och "2) Hacka …" är stegnummer, inte mängder.
  if (/^\d+[.)]\s/.test(line)) return false;
  return line.length < 48 && new RegExp(`^${AMOUNT_RE}\\s*(${UNIT_RE})?\\s+\\S`, 'i').test(line);
}

export const HEADERS = /^(ingredienser|ingrediens|gör så här|så här gör du|tillagning|instruktioner|du behöver)\s*:?$/i;

export type LineKind = 'ingr' | 'step' | 'skip';
export interface RawLine { text: string; kind: LineKind }
export interface ParsedRaw { name: string; portions: number | null; page: string; lines: RawLine[] }

/** Tolkar text från Live Text / OCR enligt reglerna i README (parseRaw). */
export function parseRaw(raw: string): ParsedRaw {
  const rows = raw.split('\n').map((x) => x.trim()).filter(Boolean);
  let name = '';
  let portions: number | null = null;
  let page = '';
  const lines: RawLine[] = [];
  let i = 0;
  while (i < rows.length && i < 3 && !/\d/.test(rows[i]) && !HEADERS.test(rows[i]) && rows[i].length < 40) {
    name += (name ? ' ' : '') + rows[i];
    i++;
  }
  for (; i < rows.length; i++) {
    const t = rows[i];
    if (HEADERS.test(t)) continue;
    if (/^\d{1,4}$/.test(t)) { page = t; continue; }
    if (/^\d+\s*portion/i.test(t)) { portions = parseInt(t, 10); continue; }
    if (looksLikeIngredient(t)) { lines.push({ text: t, kind: 'ingr' }); continue; }
    const prev = lines[lines.length - 1];
    if (prev && prev.kind === 'step' && !/[.!?]$/.test(prev.text) && !/^\d+[.)]/.test(t)) {
      prev.text += ' ' + t;
      continue;
    }
    lines.push({ text: t.replace(/^\d+[.)]\s*/, ''), kind: 'step' });
  }
  return { name, portions, page, lines };
}

/** Gissar vilka ingredienser (index) ett steg använder. */
export function guessUse(step: string, ingredientNames: string[]): number[] {
  const t = step.toLowerCase();
  const out: number[] = [];
  ingredientNames.forEach((n, k) => {
    const words = n.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
    if (words.some((w) => t.includes(w.slice(0, 5)))) out.push(k);
  });
  return out;
}

/** "4 portioner", "4-6", 4, ["4", "4 servings"] → 4 */
export function parseYield(y: unknown): number | null {
  const v = Array.isArray(y) ? y[0] : y;
  if (typeof v === 'number') return Math.round(v) || null;
  if (typeof v !== 'string') return null;
  const m = v.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}
