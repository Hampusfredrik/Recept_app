// Supabase Edge Function: hämtar en receptsida och plockar ut schema.org/Recipe.
// Anrop: GET /functions/v1/import-recipe?url=…  eller  POST { "url": "…" }
// Kräver inloggad användare (verify_jwt = true), så den kan inte användas som öppen proxy.

import { corsHeaders, json } from '../_shared/cors.ts';
import { parseIngredientLine, parseYield, recipeFromHtml } from '../_shared/parse.ts';

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
        // Vanlig webbläsare: en del sidor nekar okända program.
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
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
    html = new TextDecoder('utf-8').decode(buf);
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
