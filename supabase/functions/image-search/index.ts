// Supabase Edge Function: bildförslag från Unsplash för ett recept.
//   POST { "query": "lasagne" }            → { photos: [{ id, thumb, image, photographer, photographer_url, page_url, download_location, alt }] }
//   POST { "track": "<download_location>" } → { ok: true }  (när en bild väljs, enligt Unsplash API-riktlinjer)
// Kräver hemligheten UNSPLASH_ACCESS_KEY (Supabase → Edge Functions → Secrets) och inloggad användare.
// Unsplash kräver att bilderna visas från deras adresser och att fotografen och Unsplash krediteras
// med länkar; appen visar båda.

import { corsHeaders, json } from '../_shared/cors.ts';

type Json = Record<string, unknown>;
const APP = 'Receptappen';
const utm = (u: string) => {
  try { const x = new URL(u); x.searchParams.set('utm_source', APP); x.searchParams.set('utm_medium', 'referral'); return x.toString(); } catch { return u; }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const key = Deno.env.get('UNSPLASH_ACCESS_KEY');
  if (!key) return json({ error: 'Ingen API-nyckel för Unsplash. Lägg till hemligheten UNSPLASH_ACCESS_KEY i Supabase.' }, 500);
  const headers = { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' };

  const body = (await req.json().catch(() => ({}))) as Json;

  // En bild har valts: meddela Unsplash (räknas som en nedladdning).
  if (typeof body.track === 'string') {
    if (!body.track.startsWith('https://api.unsplash.com/photos/')) return json({ error: 'Ogiltig adress' }, 400);
    const res = await fetch(body.track, { headers, signal: AbortSignal.timeout(10_000) });
    return json({ ok: res.ok });
  }

  const query = String(body.query ?? '').trim().slice(0, 80);
  if (!query) return json({ error: 'Ange ett sökord' }, 400);

  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '12');
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('content_filter', 'high');

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (res.status === 401) return json({ error: 'Unsplash godkände inte API-nyckeln. Kontrollera UNSPLASH_ACCESS_KEY.' }, 502);
  if (res.status === 403 || res.status === 429) return json({ error: 'För många sökningar just nu. Försök igen om en stund.' }, 429);
  if (!res.ok) return json({ error: `Unsplash svarade ${res.status}` }, 502);
  const data = (await res.json()) as { results?: Json[] };

  const photos = (data.results ?? []).map((p) => {
    const urls = (p.urls ?? {}) as Record<string, string>;
    const user = (p.user ?? {}) as Json;
    const userLinks = (user.links ?? {}) as Record<string, string>;
    const links = (p.links ?? {}) as Record<string, string>;
    return {
      id: String(p.id ?? ''),
      thumb: urls.small ?? urls.thumb,
      image: urls.regular ?? urls.full,
      photographer: String(user.name ?? ''),
      photographer_url: utm(userLinks.html ?? 'https://unsplash.com'),
      page_url: utm(links.html ?? 'https://unsplash.com'),
      download_location: links.download_location ?? null,
      alt: String(p.alt_description ?? p.description ?? ''),
    };
  }).filter((p) => p.thumb && p.image);
  return json({ photos });
});
