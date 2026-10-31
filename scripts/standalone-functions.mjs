// Bygger enfilsversioner av Edge-funktionerna (delad kod inlagd) som kan
// klistras in i Supabase Dashboard → Edge Functions → editorn.
// Kör: npm run functions:standalone
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../supabase/', import.meta.url);
for (const name of ['import-recipe', 'lv-foods', 'image-search']) {
  const src = readFileSync(new URL(`functions/${name}/index.ts`, root), 'utf8');
  const shared = [];
  const body = src.replace(/^import \{[^}]*\} from '\.\.\/_shared\/([\w-]+)\.ts';\n/gm, (_, file) => {
    shared.push(`// ── från _shared/${file}.ts ──\n` + readFileSync(new URL(`functions/_shared/${file}.ts`, root), 'utf8'));
    return '';
  });
  const imports = body.match(/^import .*\n/gm) ?? [];
  const rest = body.replace(/^import .*\n/gm, '');
  const out = `// GENERERAD FIL – ändra i supabase/functions/${name}/ och kör npm run functions:standalone.\n`
    + `// Klistra in hela filen i Supabase Dashboard → Edge Functions → Deploy a new function → Via Editor.\n\n`
    + imports.join('') + '\n' + shared.join('\n') + '\n// ── funktionen ──\n' + rest;
  writeFileSync(new URL(`dashboard/${name}.ts`, root), out);
  console.log(`supabase/dashboard/${name}.ts`);
}
