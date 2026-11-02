// Ren TypeScript utan Deno- eller webbläsar-API:er. Importeras både av
// Edge-funktionen (Deno) och av frontend (Vite) så att reglerna är identiska.

export const UNITS = ['g', 'kg', 'dl', 'l', 'ml', 'cl', 'msk', 'tsk', 'krm', 'st', 'burk', 'paket', 'kruka',
  // Engelska mått sparas som de skrevs; näringsberäkningen räknar om dem (src/lib/english.ts).
  'cup', 'cups', 'tbsp', 'tbsps', 'tbps', 'tbs', 'tblsp', 'tablespoon', 'tablespoons', 'tsp', 'tsps', 'teaspoon', 'teaspoons', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'cans', 'can', 'cloves', 'clove', 'pinch'];
// Utskrivna former → förkortning. Längre ord först i regexen så att "liter" inte läses som "l".
const UNIT_ALIASES: Record<string, string> = {
  gram: 'g', kilo: 'kg', kilogram: 'kg', liter: 'l', deciliter: 'dl', centiliter: 'cl', milliliter: 'ml',
  matsked: 'msk', matskedar: 'msk', tesked: 'tsk', teskedar: 'tsk', kryddmått: 'krm', styck: 'st', stycken: 'st',
  burkar: 'burk', paket: 'paket', förp: 'paket', förpackning: 'paket', förpackningar: 'paket', krukor: 'kruka',
};
const UNIT_RE = [...Object.keys(UNIT_ALIASES), ...UNITS].sort((a, b) => b.length - a.length).join('|');
const unitOf = (u: string | undefined) => { const k = (u || '').toLowerCase(); return UNIT_ALIASES[k] ?? k; };

export interface ParsedIngredient {
  amount: number | null;
  /** Övre värdet när mängden är ett intervall ("1-2 msk" → amount 1, amount_max 2). */
  amount_max?: number | null;
  unit: string;
  name: string;
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

/** Övre värdet i ett intervall ("2-3" → 3), annars null. */
/** 1 US cup i dl (236,5882365 ml). */
export const CUP_DL = 2.365882365;
// 1 US tbsp = 14,78676478 ml (msk = 15 ml), 1 US tsp = 4,928921594 ml (tsk = 5 ml).
const TBSP_MSK = 14.78676478 / 15, TSP_TSK = 4.928921594 / 5;
export const US_TO_SV: Record<string, { unit: string; factor: number }> = {
  cup: { unit: 'dl', factor: CUP_DL }, cups: { unit: 'dl', factor: CUP_DL },
  tbsp: { unit: 'msk', factor: TBSP_MSK }, tbsps: { unit: 'msk', factor: TBSP_MSK }, tbps: { unit: 'msk', factor: TBSP_MSK },
  tbs: { unit: 'msk', factor: TBSP_MSK }, tblsp: { unit: 'msk', factor: TBSP_MSK }, tsps: { unit: 'tsk', factor: TSP_TSK }, tablespoon: { unit: 'msk', factor: TBSP_MSK }, tablespoons: { unit: 'msk', factor: TBSP_MSK },
  tsp: { unit: 'tsk', factor: TSP_TSK }, teaspoon: { unit: 'tsk', factor: TSP_TSK }, teaspoons: { unit: 'tsk', factor: TSP_TSK },
};

export function amountMax(raw: string): number | null {
  const range = raw.trim().match(/^[\d.,]+\s*[-–]\s*([\d.,]+)$/);
  return range ? parseAmount(range[1]) : null;
}

export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (FRACTIONS[s] != null) return FRACTIONS[s];
  // "1½" eller "1 ½"
  const mixed = s.match(/^(\d+)\s*([½¼¾⅓⅔])$/);
  if (mixed) return parseInt(mixed[1], 10) + FRACTIONS[mixed[2]];
  // "1 1/2"
  const mixedFrac = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedFrac) return parseInt(mixedFrac[1], 10) + parseInt(mixedFrac[2], 10) / parseInt(mixedFrac[3], 10);
  // "1/2"
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
  // "2-3" → första värdet
  const range = s.match(/^([\d.,]+)\s*[-–]\s*[\d.,]+$/);
  if (range) return parseAmount(range[1]);
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const AMOUNT_RE = '(\\d+\\s+\\d+\\/\\d+|\\d+\\s*[½¼¾⅓⅔]|[½¼¾⅓⅔]|\\d+\\/\\d+|[\\d.,]+(?:\\s*[-–]\\s*[\\d.,]+)?)';
const INGR_LINE = new RegExp(`^${AMOUNT_RE}\\s*(${UNIT_RE})?\\.?\\s+(.+)$`, 'i');

/** "400 g torskfilé" → { amount: 400, unit: 'g', name: 'torskfilé' } */
export function parseIngredientLine(line: string): ParsedIngredient {
  const t = line.trim().replace(/\s+/g, ' ').replace(/^(ca\.?|cirka|ungefär)\s+(?=[\d½¼¾⅓⅔])/i, '');
  const m = t.match(INGR_LINE);
  if (!m) return { amount: null, unit: '', name: t };
  let amount = parseAmount(m[1]);
  let max = amountMax(m[1]);
  let unit = unitOf(m[2]);
  // Engelska recept: amerikanska mått räknas om till svenska (cup → dl, tbsp → msk, tsp → tsk).
  const us = US_TO_SV[unit];
  if (us) {
    const conv = (x: number | null) => (x == null ? null : Math.round(x * us.factor * 100) / 100);
    amount = conv(amount); max = conv(max); unit = us.unit;
  }
  return { amount, ...(max != null && amount != null && max > amount ? { amount_max: max } : {}), unit, name: m[3].trim() };
}

/** Ser raden ut som en ingrediens enligt reglerna i handoffen? */
export function looksLikeIngredient(line: string): boolean {
  // "1. Skär …" och "2) Hacka …" är stegnummer, inte mängder.
  if (/^\d+[.)]\s/.test(line)) return false;
  line = line.replace(/^(ca\.?|cirka|ungefär)\s+(?=[\d½¼¾⅓⅔])/i, '');
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

// ── Recept i vanlig HTML (bloggar utan schema.org/Recipe) ──

const ENTITIES: Record<string, string> = { quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>', amp: '&', ndash: '–', mdash: '—', frac12: '½', frac14: '¼', frac34: '¾', hellip: '…' };
function decodeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Sidans huvudtext som rader: ett stycke, en listpunkt eller en rubrik per rad. */
export function htmlLines(html: string): string[] {
  let h = html.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ');
  // Bara inläggets text om sidan har en sådan del (WordPress m.fl.).
  const entry = h.search(/<(div|section)[^>]+class=["'][^"']*\b(entry-content|post-content|article-content|recipe-content)\b/i);
  if (entry >= 0) h = h.slice(entry);
  else {
    const art = h.search(/<article\b/i);
    if (art >= 0) h = h.slice(art);
  }
  return decodeHtml(h
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|table|section|article|blockquote|figure|figcaption)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').replace(/^[•·\-–*]\s*/, '').trim())
    .filter(Boolean);
}

const INGR_HEAD = /^(ingredienser|ingrediens|du behöver|det här behöver du|detta behöver du|till \d+ portioner|ingredients)\b.{0,30}$/i;
const STEP_HEAD = /^(gör så här|gör såhär|så här gör du|såhär gör du|så gör du|gör så|tillagning|instruktioner|instruktion|tillvägagångssätt|instructions|directions|method|preparation|steps)\s*:?$/i;
// Här slutar receptet på en bloggsida.
const END = /^(dela|dela detta|gilla|kommentarer?|lämna en kommentar|skriv en kommentar|relaterade|relaterat|du kanske också gillar|publicerat|publicerad|taggar|kategorier|läs också|smaklig måltid!?|smaklig spis!?|notes|recipe notes|nutrition|nutrition facts|comments|reviews|leave a comment|you may also like)\b/i;

export interface HtmlRecipe { portions: number | null; ingredients: ParsedIngredient[]; steps: string[] }

const sentence = (t: string) => /[.!?]$/.test(t);
// Rader på webbsidor kan vara längre än i en kokbok ("1 msk buljongpulver, alternativt
// 1 grönsaksbuljongtärning"), så gränsen är högre här än för Live Text.
const AMOUNT_START = new RegExp(`^(ca\\.?\\s+|cirka\\s+)?${AMOUNT_RE}\\s*(${UNIT_RE})?\\.?\\s+\\S`, 'i');
const webIngredient = (t: string) => !/^\d+[.)]\s/.test(t) && t.length <= 100 && !sentence(t) && AMOUNT_START.test(t);
// Vanliga delrubriker i ingredienslistor.
const SUBHEADS = /^(servering|till servering|att servera med|tillbehör|garnering|garnityr|topping|toppning|sås|dressing|fyllning|deg|glasyr|marinad|till ytan|till pensling)\s*:?$/i;
/** Kort rad utan mängd som inleder en del av listan: "Servering", "Brynt salviasmör:". */
const isSubhead = (t: string, next: string | undefined) =>
  t.length < 40 && (SUBHEADS.test(t) || /:$/.test(t) || (/^[A-ZÅÄÖ]/.test(t) && t.split(' ').length <= 4 && !!next && webIngredient(next)));

/** Läser ingredienser från rad `from` tills listan tar slut. */
function ingredientBlock(rows: string[], from: number): { lines: string[]; end: number } {
  const lines: string[] = [];
  let k = from;
  for (; k < rows.length; k++) {
    const t = rows[k];
    if (STEP_HEAD.test(t) || END.test(t) || INGR_HEAD.test(t.replace(/:$/, ''))) break;
    if (webIngredient(t)) { lines.push(t); continue; }
    if (t.length > 90 || sentence(t) || /^\d+[.)]\s/.test(t)) break;
    if (isSubhead(t, rows[k + 1])) continue;
    lines.push(t);
  }
  return { lines, end: k };
}

/** Hittar ingredienser och steg i en bloggtext. Tomma listor om inget hittas. */
export function recipeFromHtml(html: string): HtmlRecipe {
  return recipeFromLines(htmlLines(html));
}

/** Recept ur text som kopierats från en webbsida (när sidan inte går att hämta). */
export function recipeFromText(text: string): HtmlRecipe & { name: string } {
  const rows = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').replace(/^[•·\-–*▢□☐]\s*/, '').trim()).filter(Boolean);
  const r = recipeFromLines(rows);
  // Namnet: raden närmast före ingredienserna som ser ut som en rubrik, annars första korta raden.
  const first = r.ingredients.length ? rows.findIndex((t) => parseIngredientLine(t).name === r.ingredients[0].name) : -1;
  const before = first > 0 ? rows.slice(Math.max(0, first - 6), first).reverse() : [];
  const title = [...before, ...rows].find((t) => t.length >= 3 && t.length <= 80 && !/[.!?:]$/.test(t) && !looksLikeIngredient(t)
    && !INGR_HEAD.test(t.replace(/:$/, '')) && !STEP_HEAD.test(t) && !portionsOf(t));
  return { ...r, name: title ?? '' };
}

const portionsOf = (t: string) =>
  t.match(/^(?:till\s+)?(\d+)\s*(portioner|portion|personer|pers|servings?)\b/i) ?? t.match(/^(?:portioner|antal portioner|servings?|serves|yield|makes)\s*:?\s*(\d+)/i);

function recipeFromLines(rows: string[]): HtmlRecipe {
  const ingr: string[] = [];
  const steps: string[] = [];
  let portions: number | null = null;

  for (const t of rows) {
    const port = portionsOf(t);
    if (port && t.length < 40) { portions = parseInt(port[1], 10); break; }
  }

  // Ingredienser under en rubrik ("Ingredienser", "Du behöver"), annars den längsta
  // följden av rader med mängd (minst tre) och det som hör till den listan.
  for (let k = 0; k < rows.length; k++) {
    if (!INGR_HEAD.test(rows[k].replace(/:$/, ''))) continue;
    const b = ingredientBlock(rows, k + 1);
    ingr.push(...b.lines.filter((l) => !/^(till\s+)?\d+\s*(portioner|portion|personer|pers)\b/i.test(l)));
    k = b.end - 1;
  }
  if (!ingr.length) {
    let bestStart = -1, bestLen = 0;
    for (let k = 0; k < rows.length;) {
      if (!webIngredient(rows[k])) { k++; continue; }
      let n = 0;
      while (k + n < rows.length && webIngredient(rows[k + n])) n++;
      if (n > bestLen) { bestLen = n; bestStart = k; }
      k += n;
    }
    if (bestLen >= 3) ingr.push(...ingredientBlock(rows, bestStart).lines);
  }

  // Steg under en rubrik ("Gör så här"); delrubriker som "Risotto" hoppas över.
  const head = rows.findIndex((t) => STEP_HEAD.test(t));
  if (head >= 0) {
    for (const t of rows.slice(head + 1)) {
      if (END.test(t) || INGR_HEAD.test(t.replace(/:$/, ''))) break;
      if (!/^\d+[.)]\s/.test(t) && !sentence(t) && t.length < 40) continue;
      steps.push(t.replace(/^\d+[.)]\s*/, ''));
      if (steps.length >= 40) break;
    }
  }
  // Inga steg under en rubrik: numrerade rader ("1. Skär …").
  if (!steps.length) for (const t of rows) if (/^\d+[.)]\s+\S/.test(t) && t.length > 15) steps.push(t.replace(/^\d+[.)]\s*/, ''));

  return { portions, ingredients: ingr.map(parseIngredientLine), steps };
}

// ── Inklistrade ingredienser och steg i var sin ruta ──

const BULLET = /^[•·\-–*▢□☐✓✔]\s*/;

/**
 * En ingrediens per rad. Rubriker ("Ingredienser") hoppas över; delrubriker som
 * "Frosting:" eller "Servering" blir en del av receptet för raderna under dem.
 */
export function ingredientsFromText(text: string): (ParsedIngredient & { section: string | null })[] {
  const rows = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').replace(BULLET, '').trim()).filter(Boolean);
  const out: (ParsedIngredient & { section: string | null })[] = [];
  let section: string | null = null;
  rows.forEach((t, k) => {
    if (INGR_HEAD.test(t.replace(/:$/, '')) || portionsOf(t)) return;
    if (isSubhead(t, rows[k + 1]) && !looksLikeIngredient(t)) { section = sectionName(t); return; }
    out.push({ ...parseIngredientLine(t), section });
  });
  return out;
}

const sectionName = (t: string) => t.replace(/:$/, '').trim().replace(/^./, (c) => c.toUpperCase());

/**
 * Ett steg per stycke. Numrerade rader ("1. Skär …") börjar ett nytt steg; en rad utan
 * avslutande punkt fortsätter i nästa (radbrytning mitt i en mening). Rubriker hoppas över,
 * och korta delrubriker ("Frosting") blir en del av receptet för stegen under dem.
 */
export function stepsFromText(text: string): { text: string; section: string | null }[] {
  const rows = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').replace(BULLET, '').trim());
  const steps: { text: string; section: string | null }[] = [];
  let open = false;
  let section: string | null = null;
  for (const t of rows) {
    if (!t) { open = false; continue; }
    if (STEP_HEAD.test(t) || /^(steg|step)\s*\d+\s*:?$/i.test(t)) { open = false; continue; }
    const numbered = /^\d+[.)]\s+/.test(t);
    const clean = t.replace(/^(?:steg|step)?\s*\d+[.):]\s*/i, '');
    // Kort rad utan punkt: delrubrik ("Frosting").
    if (!numbered && clean.length < 30 && !/[.!?]$/.test(clean) && !open) { section = sectionName(clean); continue; }
    if (open && !numbered && steps.length) steps[steps.length - 1].text += ' ' + clean;
    else steps.push({ text: clean, section });
    open = !/[.!?)]$/.test(clean);
  }
  return steps.filter((x) => x.text);
}
