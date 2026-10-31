// Standardvikter per styck som används när köket inte har angett egen vikt.
// Värdena är uppskattade medelvikter angivna av användaren (inte uppmätta
// av Livsmedelsverket) och redovisas som "standardvikt" i appen.
// Matchningen är avsiktligt snäv: vitlök, purjolök m.fl. väger annat.

const STRIP = new Set(['stor', 'stora', 'medelstor', 'medelstora', 'liten', 'små', 'gul', 'gula', 'röd', 'röda', 'hel', 'hela',
  'färsk', 'färska', 'hackad', 'hackade', 'finhackad', 'finhackade', 'skivad', 'skivade', 'skalad', 'skalade', 'riven', 'rivna', 'kokt', 'kokta']);

export const PIECE_WEIGHTS: { label: string; grams: number; names: string[] }[] = [
  { label: 'lök', grams: 100, names: ['lök', 'lökar', 'rödlök', 'rödlökar', 'gullök', 'gullökar'] },
  { label: 'morot', grams: 80, names: ['morot', 'morötter'] },
  { label: 'ägg', grams: 58, names: ['ägg'] },
  { label: 'citron', grams: 125, names: ['citron', 'citroner'] },
];

/** Standardvikt i gram för 1 st av ingrediensen, eller null. */
export function standardPieceWeight(name: string): { label: string; grams: number } | null {
  const core = name.toLowerCase().split(',')[0].split(/\s+/).filter((w) => w && !STRIP.has(w)).join(' ');
  const hit = PIECE_WEIGHTS.find((p) => p.names.includes(core));
  return hit ? { label: hit.label, grams: hit.grams } : null;
}

// Buljongtärningar räknas bara som salt. 4,5 g salt per tärning är användarens
// angivna värde, inte uppmätt av Livsmedelsverket.
export const STOCK_CUBE_SALT_G = 4.5;
export const isStockCube = (name: string, unit: string) =>
  /buljongtärning/.test(name.toLowerCase()) && ['', 'st'].includes(unit.toLowerCase().trim());
