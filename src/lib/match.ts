// Matchning av ingrediensnamn mot Livsmedelsverkets livsmedelsnamn.
// Ren TypeScript utan beroenden, så att den kan testas direkt.
//
// Livsmedelsverkets namn börjar med huvudordet ("Lök gul", "Ärtor gula
// torkade", "Salt"). Regeln är därför: livsmedlets första ord måste finnas i
// ingrediensen. Hellre ingen träff än fel träff; utan träff frågar appen.

import { FOOD_DEFAULTS } from '../data/foodDefaults.ts';

export interface LvFood { id: number; name: string }

// Beskrivande ord som inte räcker för en träff på egen hand.
const DESCRIPTORS = new Set([
  'rå', 'kokt', 'kokta', 'kokad', 'torkad', 'torkade', 'torkat', 'färsk', 'färska', 'fryst', 'frysta', 'frysvara',
  'stekt', 'stekta', 'hackad', 'hackade', 'finhackad', 'riven', 'rivna', 'skivad', 'skivade', 'skalad', 'skalade',
  'hel', 'hela', 'konserverad', 'konserverade', 'tillagad', 'rökt', 'rimmat', 'rimmad', 'osaltad', 'saltad',
  'gul', 'gula', 'röd', 'röda', 'grön', 'gröna', 'vit', 'vita', 'svart', 'svarta', 'stor', 'stora', 'liten', 'små',
  'medelstor', 'medelstora', 'fint', 'grovt', 'malen', 'mald', 'malda', 'tärnad', 'tärnade', 'fast', 'fasta', 'mjölig', 'mjöliga',
  'rått', 'råa', 'okokt', 'okokta',
]);
// Tillagade varianter väljs bara om ingrediensen säger det ("stekt lök" → "Lök stekt …").
const PREPARED = new Set(['stekt', 'stekta', 'friterad', 'friterade', 'panerad', 'panerade', 'stuvad', 'stuvade', 'gratinerad',
  'hemlagad', 'tillagad', 'restaurang', 'wokad', 'grillad', 'ugnsstekt', 'värmd', 'kokt', 'kokta', 'rostad', 'rostade',
  'bakad', 'gräddad', 'inlagd', 'inlagda', 'syltade', 'marinerad', 'rökt', 'gravad', 'kallrökt', 'varmrökt', 'storhushåll',
  'torkad', 'torkade', 'torkat', 'frysvara']);
// Ord i ingrediensen som inte påverkar vilket livsmedel det är (för den fasta listan).
const KEY_MODIFIERS = new Set(['riven', 'rivna', 'hackad', 'hackade', 'finhackad', 'finhackade', 'grovhackad', 'färsk', 'färska',
  'skivad', 'skivade', 'tärnad', 'tärnade', 'strimlad', 'strimlade', 'stor', 'stora', 'liten', 'små', 'medelstor', 'medelstora',
  'skalad', 'skalade', 'fryst', 'frysta', 'ekologisk', 'ekologiska', 'eko', 'kall', 'kallt', 'rumsvarm', 'rumsvarmt', 'smält',
  'fast', 'fasta', 'mjölig', 'mjöliga', 'mogen', 'mogna', 'pressad', 'urkärnade', 'naturell',
  'smulad', 'smulade', 'finriven', 'finrivna', 'grovriven', 'grovrivna', 'rivet', 'skuren', 'skurna', 'grovt', 'fint']);
const STOP = new Set(['och', 'eller', 'el', 'med', 'm', 'utan', 'u', 'till', 'av', 'ca', 'gärna', 'kan', 'uteslutas', 'valfritt', 'efter', 'smak', 'för']);
// Måttord som ibland hamnar i namnet ("1,5 liter vatten").
const UNIT_WORDS = new Set(['liter', 'l', 'dl', 'deciliter', 'cl', 'ml', 'msk', 'tsk', 'krm', 'matsked', 'matskedar', 'tesked', 'teskedar',
  'gram', 'g', 'kg', 'kilo', 'st', 'styck', 'stycken', 'burk', 'burkar', 'paket', 'förp', 'kruka', 'krukor', 'nypa', 'knippe']);

// Oregelbundna former och sammansättningar som Livsmedelsverket skriver isär.
const REWRITE: Record<string, string[]> = {
  morötter: ['morot'], kålrötter: ['kålrot'], rötter: ['rot'], rödlök: ['lök', 'röd'], rödlökar: ['lök', 'röd'], gullök: ['lök', 'gul'], gullökar: ['lök', 'gul'],
};
// Livsmedelsverket inleder ofta kött med djurslaget ("Gris sidfläsk", "Nöt färs").
const ANIMALS = new Set(['gris', 'nöt', 'kalv', 'lamm', 'får', 'ren', 'älg', 'hjort', 'vilt', 'kyckling', 'kalkon']);
const FISH = new Set(['lax', 'torsk', 'sej', 'sill', 'tonfisk', 'kolja', 'makrill', 'abborre', 'gädda', 'räka', 'räkor', 'kräftor']);
const KINDS = new Set([...ANIMALS, ...FISH]);
/** Djur- eller fiskslag som nämns i ingrediensen, även i sammansatta ord ("kycklingfilé"). */
const kindsIn = (ws: string[]) => [...KINDS].filter((k) => ws.some((w) => w === k || (w.startsWith(k) && w.length > k.length + 2)));

// ── Fast lista för vanliga ingredienser ──
const keyOf = (s: string) => words(s).filter((w) => !STOP.has(w) && !UNIT_WORDS.has(w) && !KEY_MODIFIERS.has(w)).map(stem).join(' ');
const DEFAULT_BY_KEY = new Map<string, string>();
for (const [aliases, name] of FOOD_DEFAULTS) for (const a of aliases) DEFAULT_BY_KEY.set(keyOf(a), name);
const byNameCache = new WeakMap<LvFood[], Map<string, LvFood>>();

/** Livsmedel ur den fasta listan, om ingrediensen finns där och livsmedlet finns i databasen. */
export function defaultFood(ingredient: string, foods: LvFood[]): LvFood | null {
  const name = DEFAULT_BY_KEY.get(keyOf(ingredient));
  if (!name) return null;
  let byName = byNameCache.get(foods);
  if (!byName) { byName = new Map(foods.map((f) => [f.name.trim(), f])); byNameCache.set(foods, byName); }
  return byName.get(name) ?? null;
}

/** Gemener, utan parenteser och skiljetecken, uppdelat i ord. */
export function words(s: string): string[] {
  return s.toLowerCase().normalize('NFC')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zåäöéü\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 1)
    .flatMap((w) => REWRITE[w] ?? [w]);
}

/** Enkel svensk stam: tar bort vanliga plural- och bestämdhetsändelser. */
function stripOnce(w: string): string {
  for (const end of ['orna', 'arna', 'erna', 'or', 'ar', 'er', 'na', 'en', 'et', 'n', 'a', 'e']) if (w.length - end.length >= 3 && w.endsWith(end)) return w.slice(0, -end.length);
  return w;
}
export function stem(w: string): string {
  // Slutvokalen i singular tas också bort: rödbeta/rödbetor → rödbet, aubergine/auberginer → aubergin.
  // Upprepas tills inget ändras, så att singular och plural landar på samma stam
  // (citron/citroner → citro, banan/bananer → ban).
  let prev = w;
  for (let next = stripOnce(w); next !== prev; next = stripOnce(next)) prev = next;
  return prev;
}

/**
 * Ingrediensordet `ing` och livsmedelsordet `food` avser samma sak: samma stam,
 * livsmedelsordet ingår i ett sammansatt ingrediensord ("grönsaksbuljongtärningar"
 * innehåller "buljongtärning"), eller ingrediensordet är efterleden i ett sammansatt
 * livsmedelsord ("grädde" i "vispgrädde", "fläsk" i "sidfläsk"). Förleden räcker inte:
 * "salt" är inte "saltsill" och "vatten" inte "vattenkastanj".
 */
function covers(ing: string, food: string): boolean {
  const a = stem(ing), b = stem(food);
  if (a === b) return true;
  if (b.length >= 4 && a.includes(b)) return true;
  return a.length >= 4 && b.endsWith(a);
}

// Tillagning som antas när receptet inte anger någon (användarens val).
const DEFAULT_PREP: Record<string, string> = { potatis: 'kokt', potatisar: 'kokt' };
const PREP_WORDS = new Set(['rå', 'kokt', 'kokta', 'stekt', 'stekta', 'ugnsbakad', 'ugnsbakade', 'friterad', 'pressad', 'mos', 'råstekt']);

/** Tillagningen som ska antas för ingrediensen, t.ex. "kokt" för potatis. */
export function defaultPrep(ingredient: string): string | null {
  const w = words(ingredient);
  if (w.some((x) => PREP_WORDS.has(x))) return null;
  const core = w.filter((x) => !DESCRIPTORS.has(x) && !STOP.has(x) && !UNIT_WORDS.has(x));
  return core.length === 1 ? DEFAULT_PREP[core[0]] ?? null : null;
}

export function matchFood(ingredient: string, foods: LvFood[]): { food: LvFood; sure: boolean } | null {
  const preset = defaultFood(ingredient, foods);
  if (preset) return { food: preset, sure: true };
  const prep = defaultPrep(ingredient);
  const ing = [...words(ingredient), ...(prep ? [prep] : [])].filter((w) => !STOP.has(w) && !UNIT_WORDS.has(w));
  const ingCore = ing.filter((w) => !DESCRIPTORS.has(w));
  if (!ingCore.length) return null;
  const ingKinds = kindsIn(ing);
  const ingStems = new Set(ing.map(stem));

  let best: { food: LvFood; score: number; sure: boolean } | null = null;
  for (const f of foods) {
    // "u. salt" (utan) och "m. salt" säger inget om vilket livsmedel det är.
    const fw = words(f.name).filter((w, k, all) => !STOP.has(w) && !(['u', 'utan'].includes(all[k - 1])) && !(all[k - 1] === 'm' && w === 'salt'));
    if (!fw.length) continue;
    // Livsmedlets huvudord måste finnas bland ingrediensens kärnord. Huvudordet är
    // första ordet, eller ordet efter djurslaget för kött.
    // Inleds namnet med ett beskrivande ord ("Gula ärtor torkade") är huvudordet nästa ord.
    const first = fw.find((w) => !DESCRIPTORS.has(w)) ?? fw[0];
    const at = fw.indexOf(first);
    const heads = ANIMALS.has(first) && fw[at + 1] ? [first, fw[at + 1]] : [first];
    if (!ingCore.some((w) => heads.some((h) => covers(w, h)))) continue;
    // Fel djurslag: "kycklingfilé" ska aldrig bli "Kalv filé".
    if (KINDS.has(first) && ingKinds.length && !ingKinds.includes(first)) continue;
    const exactHead = ingCore.some((w) => stem(w) === stem(first));

    const fCore = fw.filter((w) => !DESCRIPTORS.has(w));
    const fDesc = fw.filter((w) => DESCRIPTORS.has(w));
    const coveredIng = ingCore.filter((w) => fCore.some((x) => covers(w, x))).length;
    const matchedFood = fCore.filter((x) => ing.some((w) => covers(w, x))).length;
    const extraFood = fCore.length - matchedFood;
    // Böjningar jämförs på stammen: röd/röda, kokt/kokta, inlagd/inlagda.
    const descAgree = fDesc.filter((d) => ingStems.has(stem(d))).length;
    const descConflict = fDesc.filter((d) => !ingStems.has(stem(d))).length;
    const prepared = fw.filter((w) => PREPARED.has(w) && !ingStems.has(stem(w))).length;

    const score = coveredIng / ingCore.length * 10
      + matchedFood * 2
      - extraFood * 1.5
      + (exactHead ? 5 : 0)
      + descAgree * 1.5
      - descConflict * 0.4
      - prepared * 2
      + (fw.includes('rå') && !ing.some((w) => ['kokt', 'kokta', 'stekt', 'stekta'].includes(w)) ? 0.3 : 0)
      - fw.length * 0.05;
    const sure = coveredIng === ingCore.length && extraFood === 0;
    if (!best || score > best.score) best = { food: f, score, sure };
  }
  return best ? { food: best.food, sure: best.sure } : null;
}
