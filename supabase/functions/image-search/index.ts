// Supabase Edge Function: bildförslag från Pexels för ett recept.
//   POST { "query": "lasagne" } → { photos: [{ id, thumb, image, photographer, photographer_url, pexels_url, alt }] }
// Kräver hemligheten PEXELS_API_KEY (Supabase → Edge Functions → Secrets) och inloggad användare.
// Pexels kräver att de anges som källa och att fotografen krediteras; appen visar båda.

import { corsHeaders, json } from '../_shared/cors.ts';

type Json = Record<string, unknown>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const key = Deno.env.get('PEXELS_API_KEY');
  if (!key) return json({ error: 'Ingen API-nyckel för Pexels. Lägg till hemligheten PEXELS_API_KEY i Supabase.' }, 500);

  const body = (await req.json().catch(() => ({}))) as Json;
  const query = String(body.query ?? '').trim().slice(0, 80);
  if (!query) return json({ error: 'Ange ett sökord' }, 400);

  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '12');
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('locale', 'sv-SE');

  const res = await fetch(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(10_000) });
  if (res.status === 429) return json({ error: 'För många sökningar just nu. Försök igen om en stund.' }, 429);
  if (!res.ok) return json({ error: `Pexels svarade ${res.status}` }, 502);
  const data = (await res.json()) as { photos?: Json[] };

  const photos = (data.photos ?? []).map((p) => {
    const src = (p.src ?? {}) as Record<string, string>;
    return {
      id: p.id,
      thumb: src.medium ?? src.small,
      image: src.large ?? src.landscape ?? src.original,
      photographer: p.photographer,
      photographer_url: p.photographer_url,
      pexels_url: p.url,
      alt: p.alt ?? '',
    };
  }).filter((p) => p.thumb && p.image);
  return json({ photos });
});
