// Kopierar Tesseracts filer och den svenska språkmodellen till public/tesseract,
// så att textläsningen inte hämtar något från externa servrar (CDN).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const out = new URL('../public/tesseract/', import.meta.url);
const nm = new URL('../node_modules/', import.meta.url);
mkdirSync(new URL('lang/', out), { recursive: true });

copyFileSync(new URL('tesseract.js/dist/worker.min.js', nm), new URL('worker.min.js', out));
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  copyFileSync(new URL(`tesseract.js-core/${f}`, nm), new URL(f, out));
}
// Okomprimerad, så att servern inte kan packa upp den i förväg av misstag.
const gz = readFileSync(new URL('@tesseract.js-data/swe/4.0.0_best_int/swe.traineddata.gz', nm));
writeFileSync(new URL('lang/swe.traineddata', out), gunzipSync(gz));
console.log('Tesseract-filer kopierade till public/tesseract');
