// Standardvikter som används när köket inte har angett egen vikt.
//
// Källor:
//  - "användaren": värden som användaren själv har bestämt.
//  - "Mattilsynet 2015": Mål, vekt og porsjonsstørrelser for matvarer (Mattilsynet,
//    Universitetet i Oslo och Helsedirektoratet, 2015, IS-2286). Styckvikter är netto,
//    alltså ätlig del. Där tabellen anger flera storlekar används medelvärdet.
//  - "Livsmedelsverket PM 2024": Volymvikter, viktförändringsfaktorer och avfall.
//
// Matchningen är snäv: bara de namn som står här (i singular eller plural) träffas.
import { stem, words } from '../lib/match.ts';

const STRIP = new Set(['stor', 'stora', 'medelstor', 'medelstora', 'liten', 'små', 'gul', 'gula', 'röd', 'röda', 'grön', 'gröna',
  'hel', 'hela', 'färsk', 'färska', 'hackad', 'hackade', 'finhackad', 'finhackade', 'skivad', 'skivade', 'skalad', 'skalade',
  'riven', 'rivna', 'kokt', 'kokta', 'fast', 'fasta', 'mjölig', 'mjöliga', 'mogen', 'mogna', 'ekologisk', 'ekologiska']);

const MT = 'Mattilsynet 2015';
const LV = 'Livsmedelsverket PM 2024';
const USER = 'användaren';

/** Gram per styck. */
export const PIECE_WEIGHTS: { grams: number; source: string; names: string[] }[] = [
  { grams: 100, source: USER, names: ['lök', 'gullök'] },
  { grams: 80, source: USER, names: ['morot'] },
  { grams: 58, source: USER, names: ['ägg'] },
  { grams: 125, source: USER, names: ['citron'] },
  { grams: 2.5, source: MT, names: ['vitlöksklyfta', 'klyfta vitlök', 'vitlöksklyfta'] },
  { grams: 145, source: MT, names: ['paprika'] },
  { grams: 95, source: MT, names: ['tomat'] },
  { grams: 15, source: MT, names: ['körsbärstomat', 'cocktailtomat', 'cherrytomat'] },
  { grams: 325, source: MT, names: ['gurka'] },
  { grams: 175, source: MT, names: ['avokado'] },
  { grams: 395, source: MT, names: ['broccoli', 'broccolihuvud'] },
  { grams: 480, source: MT, names: ['blomkål', 'blomkålshuvud'] },
  { grams: 285, source: MT, names: ['aubergine'] },
  { grams: 285, source: MT, names: ['zucchini', 'squash'] },
  { grams: 470, source: MT, names: ['isbergssallad', 'isbergssallat'] },
  { grams: 210, source: MT, names: ['purjolök'] },
  { grams: 19, source: MT, names: ['salladslök', 'vårlök'] },
  { grams: 29, source: MT, names: ['schalottenlök', 'schalottenlöksklyfta'] },
  { grams: 120, source: MT, names: ['rödbeta'] },
  { grams: 130, source: MT, names: ['sötpotatis'] },
  { grams: 18, source: MT, names: ['champinjon'] },
  { grams: 7, source: MT, names: ['chili', 'chilipeppar', 'chilifrukt'] },
  { grams: 140, source: MT, names: ['fänkål'] },
  { grams: 830, source: MT, names: ['kålrot'] },
  { grams: 100, source: MT, names: ['palsternacka'] },
  { grams: 545, source: MT, names: ['rotselleri', 'selleri'] },
  { grams: 33, source: MT, names: ['selleristjälk', 'blekselleri', 'stjälkselleri'] },
  { grams: 1150, source: MT, names: ['vitkål', 'vitkålshuvud'] },
  { grams: 1200, source: MT, names: ['rödkål'] },
  { grams: 800, source: MT, names: ['spetskål'] },
  { grams: 735, source: MT, names: ['kinakål', 'salladskål'] },
  { grams: 140, source: MT, names: ['majskolv'] },
  { grams: 4, source: MT, names: ['rädisa'] },
  { grams: 55, source: MT, names: ['potatis'] },
  { grams: 120, source: MT, names: ['banan'] },
  { grams: 125, source: MT, names: ['äpple'] },
  { grams: 195, source: MT, names: ['apelsin'] },
  { grams: 72.5, source: MT, names: ['klementin', 'mandarin'] },
  { grams: 75, source: MT, names: ['kiwi'] },
  { grams: 65, source: MT, names: ['lime'] },
  { grams: 18, source: MT, names: ['äggula'] },
  { grams: 37, source: MT, names: ['äggvita'] },
  { grams: 80, source: MT, names: ['hamburgerbröd'] },
  { grams: 75, source: MT, names: ['pitabröd'] },
  { grams: 50, source: MT, names: ['tortilla', 'tortillabröd', 'vetetortilla'] },
  { grams: 45, source: MT, names: ['korvbröd'] },
  { grams: 17, source: MT, names: ['lasagneplatta'] },
];

/** Gram per dl. Används för dl, msk, tsk m.m. i stället för att anta 1 g/ml. */
export const DL_WEIGHTS: { grams: number; source: string; names: string[] }[] = [
  { grams: 56, source: LV, names: ['vetemjöl'] },
  { grams: 39, source: LV, names: ['havregryn'] },
  { grams: 99, source: LV, names: ['mjölk', 'standardmjölk', 'mellanmjölk'] },
  { grams: 98, source: LV, names: ['lättmjölk'] },
  { grams: 103, source: LV, names: ['grädde', 'vispgrädde'] },
  { grams: 95, source: LV, names: ['crème fraiche', 'creme fraiche'] },
  { grams: 110, source: LV, names: ['filmjölk'] },
  { grams: 108, source: LV, names: ['grekisk yoghurt'] },
  { grams: 105, source: LV, names: ['turkisk yoghurt'] },
  { grams: 69, source: LV, names: ['majs', 'majskorn'] },
  { grams: 80, source: MT, names: ['ris', 'jasminris', 'basmatiris', 'långkornigt ris'] },
  { grams: 75, source: MT, names: ['couscous'] },
  { grams: 90, source: MT, names: ['socker', 'strösocker'] },
  { grams: 70, source: MT, names: ['farinsocker', 'brunt socker'] },
  { grams: 140, source: MT, names: ['honung'] },
  { grams: 90, source: MT, names: ['olja', 'matolja', 'rapsolja', 'olivolja', 'neutral olja'] },
  { grams: 85, source: MT, names: ['smör', 'smält smör'] },
  { grams: 85, source: MT, names: ['linser', 'röda linser', 'gröna linser'] },
  { grams: 80, source: MT, names: ['gula ärtor', 'gula ärter', 'torkade gula ärter', 'torkade gula ärtor', 'ärtor'] },
  { grams: 90, source: MT, names: ['kidneybönor', 'svarta bönor'] },
  { grams: 75, source: MT, names: ['kikärtor', 'kikärter'] },
  { grams: 12, source: MT, names: ['dill', 'persilja', 'spenat', 'babyspenat'] },
  { grams: 5, source: MT, names: ['basilika', 'koriander'] },
  { grams: 11, source: MT, names: ['ruccola', 'rucola'] },
];

const keyOf = (name: string) => words(name.split(',')[0]).filter((w) => !STRIP.has(w)).map(stem).join(' ');
const index = (list: { grams: number; source: string; names: string[] }[]) => {
  const m = new Map<string, { grams: number; source: string }>();
  for (const e of list) for (const n of e.names) m.set(keyOf(n), { grams: e.grams, source: e.source });
  return m;
};
const PIECE = index(PIECE_WEIGHTS);
const DL = index(DL_WEIGHTS);

/** Standardvikt i gram för 1 st av ingrediensen, eller null. */
export const standardPieceWeight = (name: string) => PIECE.get(keyOf(name)) ?? null;
/** Standardvikt i gram för 1 dl av ingrediensen, eller null. */
export const standardDlWeight = (name: string) => DL.get(keyOf(name)) ?? null;

// Buljongtärningar räknas bara som salt. 4,5 g salt per tärning är användarens
// angivna värde, inte uppmätt av Livsmedelsverket.
export const STOCK_CUBE_SALT_G = 4.5;
export const isStockCube = (name: string, unit: string) =>
  /buljongtärning/.test(name.toLowerCase()) && ['', 'st'].includes(unit.toLowerCase().trim());
