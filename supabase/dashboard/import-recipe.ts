// GENERERAD FIL – ändra i supabase/functions/import-recipe/ och kör npm run functions:standalone.
// Klistra in hela filen i Supabase Dashboard → Edge Functions → Deploy a new function → Via Editor.


// ── från _shared/cors.ts ──
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ── från _shared/parse.ts ──
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

const ENTITIES: Record<string, string> = {
  quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>', amp: '&', ndash: '–', mdash: '—', hellip: '…', frac12: '½', frac14: '¼', frac34: '¾',
  aring: 'å', auml: 'ä', ouml: 'ö', Aring: 'Å', Auml: 'Ä', Ouml: 'Ö', eacute: 'é', Eacute: 'É', egrave: 'è', ecirc: 'ê', agrave: 'à', aacute: 'á',
  acirc: 'â', uuml: 'ü', Uuml: 'Ü', iuml: 'ï', ccedil: 'ç', ntilde: 'ñ', oslash: 'ø', Oslash: 'Ø', aelig: 'æ', AElig: 'Æ', szlig: 'ß', ocirc: 'ô',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', deg: '°', times: '×', bull: '•', middot: '·', minus: '−', shy: '',
};
/** HTML-koder → tecken, t.ex. "&auml;" → "ä", "&#228;" → "ä". Dubbelkodade ("&amp;auml;") avkodas också. */
export function decodeHtml(s: string): string {
  const once = (x: string) => x
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => ENTITIES[n] ?? ENTITIES[n.toLowerCase()] ?? m);
  const a = once(s);
  return /&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/i.test(a) && /&amp;/i.test(s) ? once(a) : a;
}

/**
 * Text som avkodats två gånger ("Ã¤" i stället för "ä", "Ã¥" för "å") rättas.
 * Bara när mönstret syns och resultatet blir giltig UTF-8.
 */
export function fixMojibake(s: string): string {
  if (!/Ã[\u0080-¿]|Ã[¤¥¶„…–©¨¼]/.test(s) || [...s].some((c) => c.charCodeAt(0) > 0xff && !CP1252_REV[c])) return s;
  const bytes = Uint8Array.from([...s].map((c) => CP1252_REV[c] ?? c.charCodeAt(0)));
  const out = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return out.includes('\uFFFD') ? s : out;
}
// Tecken i windows-1252 (0x80–0x9f) som feltolkad UTF-8 ofta innehåller, t.ex. "Ã„" (Ä) och "Ã–" (Ö).
const CP1252_REV: Record<string, number> = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
  '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a,
  '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };

/**
 * Sidans bytes → text med rätt teckenkodning: från Content-Type, annars från <meta charset>
 * i början av sidan, annars UTF-8. Blir UTF-8 ogiltig används windows-1252 (äldre svenska sidor).
 */
export function decodeBody(buf: ArrayBuffer | Uint8Array, contentType: string | null): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
  const label = (contentType?.match(/charset=["']?([\w-]+)/i)?.[1]
    ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? 'utf-8').toLowerCase();
  const enc = /^(iso-8859-1|latin-?1|windows-1252|cp1252|us-ascii|ascii)$/.test(label) ? 'windows-1252' : /^utf-?8$/.test(label) ? 'utf-8' : label;
  let text: string;
  try { text = new TextDecoder(enc).decode(bytes); } catch { text = new TextDecoder('utf-8').decode(bytes); }
  // Ogiltig UTF-8 (ersättningstecken) men ingen angiven kodning: troligen en äldre sida i windows-1252.
  if (enc === 'utf-8' && text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(bytes);
  return text;
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
    .map(fixMojibake)
    .filter(Boolean);
}

const INGR_HEAD = /^(ingredienser|ingrediens|du behöver|det här behöver du|detta behöver du|till \d+ portioner|ingredients)\b.{0,30}$/i;
const STEP_HEAD = /^(gör så här|gör såhär|så här gör du|såhär gör du|så gör du|gör så|tillagning|instruktioner|instruktion|tillvägagångssätt|instructions|directions|method|preparation|steps)\s*:?$/i;
// Här slutar receptet på en bloggsida.
const END = /^(dela|dela detta|gilla|kommentarer?|lämna en kommentar|skriv en kommentar|relaterade|relaterat|du kanske också gillar|publicerat|publicerad|taggar|kategorier|läs också|smaklig måltid!?|smaklig spis!?|notes|recipe notes|nutrition|nutrition facts|comments|reviews|leave a comment|you may also like)\b/i;

export type Sectioned<T> = T & { section: string | null };
export interface HtmlRecipe { portions: number | null; ingredients: Sectioned<ParsedIngredient>[]; steps: Sectioned<{ text: string }>[] }

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
/** Läser ingredienser från rad `from` tills listan tar slut. Delrubriker ("Sås", "Sallad:") blir delar av receptet. */
function ingredientBlock(rows: string[], from: number, start: string | null = null): { lines: { text: string; section: string | null }[]; end: number } {
  const lines: { text: string; section: string | null }[] = [];
  let section = start;
  let k = from;
  for (; k < rows.length; k++) {
    const t = rows[k];
    if (STEP_HEAD.test(t) || END.test(t) || INGR_HEAD.test(t.replace(/:$/, ''))) break;
    if (webIngredient(t)) { lines.push({ text: t, section }); continue; }
    if (t.length > 90 || sentence(t) || /^\d+[.)]\s/.test(t)) break;
    if (isSubhead(t, rows[k + 1])) { section = sectionName(t); continue; }
    lines.push({ text: t, section });
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

/**
 * Stegens delar: delar som bara finns bland stegen och inte bland ingredienserna behålls,
 * men om ingredienserna saknar delar helt och stegen bara har en del räknas den som huvuddelen.
 */
function alignSections(ingrSections: (string | null)[], steps: Sectioned<{ text: string }>[]) {
  const stepSecs = new Set(steps.map((x) => x.section).filter(Boolean));
  if (!ingrSections.some(Boolean) && stepSecs.size <= 1) return steps.map((x) => ({ ...x, section: null }));
  return steps;
}

function recipeFromLines(rows: string[]): HtmlRecipe {
  const ingr: { text: string; section: string | null }[] = [];
  const steps: { text: string; section: string | null }[] = [];
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
    ingr.push(...b.lines.filter((l) => !portionsOf(l.text)));
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

  // Steg under en rubrik ("Gör så här"); delrubriker som "Sås" blir delar av receptet.
  const head = rows.findIndex((t) => STEP_HEAD.test(t));
  if (head >= 0) {
    let section: string | null = null;
    for (const t of rows.slice(head + 1)) {
      if (END.test(t) || INGR_HEAD.test(t.replace(/:$/, ''))) break;
      if (!/^\d+[.)]\s/.test(t) && !sentence(t) && t.length < 40) { section = sectionName(t); continue; }
      steps.push({ text: t.replace(/^\d+[.)]\s*/, ''), section });
      if (steps.length >= 40) break;
    }
  }
  // Inga steg under en rubrik: numrerade rader ("1. Skär …").
  if (!steps.length) for (const t of rows) if (/^\d+[.)]\s+\S/.test(t) && t.length > 15) steps.push({ text: t.replace(/^\d+[.)]\s*/, ''), section: null });

  return { portions, ingredients: ingr.map((l) => ({ ...parseIngredientLine(l.text), section: l.section })), steps: alignSections(ingr.map((l) => l.section), steps) };
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

/**
 * Ingrediensgrupper på sidan (t.ex. "Sås", "Sallad") för recept med schema.org-data, där
 * ingredienserna kommer som en enda lista. Rubriker och listpunkter läses i sidans ordning;
 * varje ingrediens får rubriken närmast före sig. Nyckeln är ingrediensens text, förenklad.
 */
export function ingredientGroups(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const h = html.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  const re = /<(h[2-6])\b[^>]*>([\s\S]*?)<\/\1>|<(?:div|span|p|strong)\b[^>]*class=["'][^"']*(?:group-name|group-title|ingredient-group-name|ingredients-group-title|tasty-recipes-ingredients-header)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p|strong)>|<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let current: string | null = null;
  const text = (x: string) => fixMojibake(decodeHtml(x.replace(/<[^>]+>/g, ' '))).replace(/\s+/g, ' ').trim();
  for (const m of h.matchAll(re)) {
    const head = m[2] ?? m[3];
    if (head != null) {
      const t = text(head).replace(/:$/, '');
      // Rubriker som "Ingredienser" eller "Gör så här" är inga grupper.
      current = !t || t.length > 40 || INGR_HEAD.test(t) || STEP_HEAD.test(t) || END.test(t) ? null : sectionName(t);
      continue;
    }
    const li = text(m[4] ?? '');
    if (current && li && li.length < 200) map.set(groupKey(li), current);
  }
  return map;
}
export const groupKey = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Del för varje ingrediens i schema.org-listan, i samma ordning. Sidans listpunkter gås igenom
 * i ordning; en ingrediens matchar en listpunkt med samma text, eller där den ena texten börjar
 * med den andra (t.ex. en kommentar efter ingrediensen på sidan). Hittas ingen matchning ärvs
 * delen från ingrediensen före, eftersom listan och sidan har samma ordning.
 */
export function sectionsForIngredients(html: string, ingredients: string[]): (string | null)[] {
  const h = html.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  const re = /<(h[2-6])\b[^>]*>([\s\S]*?)<\/\1>|<(?:div|span|p|strong)\b[^>]*class=["'][^"']*(?:group-name|group-title|ingredient-group-name|ingredients-group-title|tasty-recipes-ingredients-header)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p|strong)>|<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  const text = (x: string) => fixMojibake(decodeHtml(x.replace(/<[^>]+>/g, ' '))).replace(/\s+/g, ' ').trim();
  const items: { key: string; section: string | null }[] = [];
  let current: string | null = null;
  for (const m of h.matchAll(re)) {
    const head = m[2] ?? m[3];
    if (head != null) {
      const t = text(head).replace(/:$/, '');
      current = !t || t.length > 40 || INGR_HEAD.test(t) || STEP_HEAD.test(t) || END.test(t) ? null : sectionName(t);
      continue;
    }
    const key = groupKey(text(m[4] ?? ''));
    if (key) items.push({ key, section: current });
  }
  const same = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
  let at = 0;
  let last: string | null = null;
  const out = ingredients.map((ing) => {
    const k = groupKey(ing);
    const j = items.findIndex((x, n) => n >= at && same(x.key, k));
    if (j < 0) return last;
    at = j + 1;
    last = items[j].section;
    return last;
  });
  // Bara en del (eller ingen): ingen uppdelning.
  return new Set(out).size < 2 ? out.map(() => null) : out;
}

// ── funktionen ──
// Supabase Edge Function: hämtar en receptsida och plockar ut schema.org/Recipe.
// Anrop: GET /functions/v1/import-recipe?url=…  eller  POST { "url": "…" }
// Kräver inloggad användare (verify_jwt = true), så den kan inte användas som öppen proxy.


const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 10_000;

function isPublicHttpUrl(u: URL): boolean {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
  // Blockera IP-literaler i privata/reserverade intervall.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) return false;
  }
  if (h.startsWith('[') || h.includes(':')) return false; // IPv6-literaler
  return true;
}

// HTML-koder ("&auml;") och dubbelkodad text ("Ã¤") blir riktiga tecken.
const decodeEntities = (s: string) => fixMojibake(decodeHtml(s));

function clean(s: unknown): string {
  return typeof s === 'string' ? decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '';
}

type Json = Record<string, unknown>;

function isRecipe(node: Json): boolean {
  const t = node['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
}

function findRecipe(data: unknown): Json | null {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data)) {
    for (const d of data) { const r = findRecipe(d); if (r) return r; }
    return null;
  }
  const node = data as Json;
  if (isRecipe(node)) return node;
  if (node['@graph']) return findRecipe(node['@graph']);
  if (node['mainEntity']) return findRecipe(node['mainEntity']);
  return null;
}

function imageOf(img: unknown): string | null {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return imageOf(img[0]);
  if (typeof img === 'object') return (img as Json).url as string ?? null;
  return null;
}

type StepOut = { text: string; section: string | null };
/** Stegen; avsnitt (HowToSection, t.ex. "Sås") blir delar av receptet. */
function stepsOf(ins: unknown, section: string | null = null): StepOut[] {
  if (!ins) return [];
  if (typeof ins === 'string') return clean(ins).split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ])/).filter(Boolean).map((text) => ({ text, section }));
  if (Array.isArray(ins)) return ins.flatMap((x) => stepsOf(x, section));
  if (typeof ins === 'object') {
    const n = ins as Json;
    if (n['@type'] === 'HowToSection' || n.itemListElement) {
      const name = clean(n.name);
      return stepsOf(n.itemListElement, name && !/^(instructions|instruktioner|gör så här|method|directions)$/i.test(name) ? name : section);
    }
    const t = clean(n.text ?? n.name);
    return t ? [{ text: t, section }] : [];
  }
  return [];
}

function meta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decodeEntities(c) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let raw = new URL(req.url).searchParams.get('url');
  if (!raw && req.method === 'POST') {
    try { raw = ((await req.json()) as Json).url as string; } catch { /* tom body */ }
  }
  if (!raw) return json({ error: 'Ange url' }, 400);

  let target: URL;
  try { target = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { return json({ error: 'Ogiltig webbadress' }, 400); }
  if (!isPublicHttpUrl(target)) return json({ error: 'Adressen stöds inte' }, 400);

  let html: string;
  try {
    const res = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Appen presenterar sig ärligt. Sidor som nekar den respekteras; då kan receptet klistras in som text.
        'User-Agent': 'Mozilla/5.0 (compatible; Receptappen/1.0; +https://github.com/Hampusfredrik/Recept_app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.5',
      },
    });
    if (!res.ok) {
      const why = res.status === 403 || res.status === 401 ? 'sidan nekar appen att hämta den'
        : res.status === 404 ? 'sidan finns inte' : res.status === 429 ? 'sidan begränsar antalet hämtningar, försök igen om en stund' : 'sidan svarade inte som väntat';
      return json({ error: `${why} (HTTP ${res.status})` }, 502);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return json({ error: 'Sidan är för stor' }, 502);
    html = decodeBody(buf, res.headers.get('content-type'));
  } catch (e) {
    const timeout = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return json({ error: timeout ? 'sidan svarade inte inom 10 sekunder' : 'sidan gick inte att nå', detail: String(e) }, 502);
  }

  let recipe: Json | null = null;
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      recipe = findRecipe(JSON.parse(m[1].trim()));
      if (recipe) break;
    } catch { /* trasig JSON-LD, prova nästa */ }
  }

  const domain = target.hostname.replace(/^www\./, '');
  const resolve = (u: string | null) => { try { return u ? new URL(u, target).toString() : null; } catch { return null; } };

  if (recipe) {
    // Ingredienserna kommer som en lista; grupper som "Sås" och "Sallad" läses från sidan.
    const lines = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : []).map(clean).filter(Boolean);
    const sections = sectionsForIngredients(html, lines);
    const ingredients = lines.map((t, k) => ({ ...parseIngredientLine(t), section: sections[k] }));
    const steps = stepsOf(recipe.recipeInstructions);
    if (new Set(steps.map((x) => x.section)).size === 1) for (const x of steps) x.section = null;
    return json({
      found: 'recipe',
      url: target.toString(),
      domain,
      name: clean(recipe.name) || meta(html, 'og:title') || '',
      image: resolve(imageOf(recipe.image)) ?? resolve(meta(html, 'og:image')),
      portions: parseYield(recipe.recipeYield),
      ingredients,
      steps,
    });
  }

  const title = meta(html, 'og:title') ?? clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);

  // Reserv 1: receptet står som vanlig text på sidan (vanligt på bloggar).
  const plain = recipeFromHtml(html);
  if (plain.ingredients.length) {
    const h1 = clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
    return json({
      found: 'html',
      url: target.toString(),
      domain,
      name: h1 || title || '',
      image: resolve(meta(html, 'og:image')),
      portions: plain.portions,
      ingredients: plain.ingredients,
      steps: plain.steps,
    });
  }

  // Reserv 2: Open Graph.
  return json({
    found: 'opengraph',
    url: target.toString(),
    domain,
    name: title ?? '',
    image: resolve(meta(html, 'og:image')),
    portions: null,
    ingredients: [],
    steps: [],
  });
});
