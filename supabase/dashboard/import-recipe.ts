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

export const UNITS = ['g', 'kg', 'dl', 'l', 'ml', 'cl', 'msk', 'tsk', 'krm', 'st', 'burk', 'paket', 'kruka'];
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
  return { amount: parseAmount(m[1]), unit: unitOf(m[2]), name: m[3].trim() };
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

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

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

function stepsOf(ins: unknown): string[] {
  if (!ins) return [];
  if (typeof ins === 'string') return clean(ins).split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ])/).filter(Boolean);
  if (Array.isArray(ins)) return ins.flatMap(stepsOf);
  if (typeof ins === 'object') {
    const n = ins as Json;
    if (n['@type'] === 'HowToSection' || n.itemListElement) return stepsOf(n.itemListElement);
    const t = clean(n.text ?? n.name);
    return t ? [t] : [];
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
        'User-Agent': 'Mozilla/5.0 (compatible; Receptappen/1.0; +https://github.com/Hampusfredrik/Recept_app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.5',
      },
    });
    if (!res.ok) return json({ error: `Sidan svarade ${res.status}` }, 502);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return json({ error: 'Sidan är för stor' }, 502);
    html = new TextDecoder('utf-8').decode(buf);
  } catch (e) {
    return json({ error: 'Kunde inte hämta sidan', detail: String(e) }, 502);
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
    const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [])
      .map(clean).filter(Boolean).map(parseIngredientLine);
    return json({
      found: 'recipe',
      url: target.toString(),
      domain,
      name: clean(recipe.name) || meta(html, 'og:title') || '',
      image: resolve(imageOf(recipe.image)) ?? resolve(meta(html, 'og:image')),
      portions: parseYield(recipe.recipeYield),
      ingredients,
      steps: stepsOf(recipe.recipeInstructions),
    });
  }

  // Reserv: Open Graph.
  const title = meta(html, 'og:title') ?? clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
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
