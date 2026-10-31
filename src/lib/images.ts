// Förminskar en bild i webbläsaren innan den laddas upp, så att recepten laddar snabbt.
const MAX_SIDE = 1600;

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bilden kunde inte läsas. Prova en annan bild.')); };
    img.src = url;
  });
}

/** JPEG med längsta sidan högst 1600 px. */
export async function shrinkImage(file: File): Promise<Blob> {
  const img = await load(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Bilden kunde inte sparas.'))), 'image/jpeg', 0.82));
}

// ── Bildförslag från Pexels (via Edge Function image-search) ──
import { supabase } from './supabase';
import { functionError } from './nutrition';

export interface PexelsPhoto { id: number; thumb: string; image: string; photographer: string; photographer_url: string; pexels_url: string; alt: string }

export async function searchImages(query: string): Promise<PexelsPhoto[]> {
  const { data, error } = await supabase.functions.invoke('image-search', { body: { query } });
  if (error) throw await functionError(error);
  return (data?.photos ?? []) as PexelsPhoto[];
}

// Krediteringen sparas i bildadressens fragment (#…), som inte skickas till servern
// men följer med receptet, så att fotografen kan visas utan extra kolumn i databasen.
export const withCredit = (p: PexelsPhoto) =>
  `${p.image}#pexels=${encodeURIComponent(JSON.stringify({ n: p.photographer, u: p.photographer_url, p: p.pexels_url }))}`;

export function creditOf(imageUrl: string | null): { name: string; url: string; photo: string } | null {
  const m = imageUrl?.match(/#pexels=(.+)$/);
  if (!m) return null;
  try { const c = JSON.parse(decodeURIComponent(m[1])); return { name: c.n, url: c.u, photo: c.p }; } catch { return null; }
}
