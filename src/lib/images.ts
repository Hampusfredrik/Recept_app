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
