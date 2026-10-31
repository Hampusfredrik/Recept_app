import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchFood } from '../src/lib/match.ts';
import { FOOD_DEFAULTS } from '../src/data/foodDefaults.ts';

// Namnen i den fasta listan plus verkliga namn ur Livsmedelsverkets databas
// som tidigare gav fel träff (hämtade 2026-10-31).
const decoys = ['Älg färs rå', 'Kalv filé rå', 'Ägg stekt', 'Kyckling hjärta rå', 'Soja- och veteprotein färs frysvara',
  'Kaffegrädde fett 12%', 'Vatten kokosvatten', 'Salt mineralsalt', 'Banan kokbanan', 'Tomat körsbärstomat röd',
  'Potatis mandelpotatis kokt m. salt', 'Mjölk fett 4,2% typ lantmjölk', 'Paprika grön', 'Paprika röd', 'Chili- och mangosås',
  'Gröna bönor', 'Lasagne blandfärs', 'Halloumi stroganoff veg.', 'Sallad m. skaldjur majonnäsdressing', 'Rödbeta'];
const foods = [...new Set([...FOOD_DEFAULTS.map(([, n]) => n), ...decoys])].map((name, id) => ({ id, name }));
const m = (s: string) => matchFood(s, foods)?.food.name ?? null;

test('vanliga ingredienser får rätt livsmedel', () => {
  const cases: [string, string][] = [
    ['nötfärs', 'Nöt färs rå fett 10%'], ['kycklingfilé', 'Kyckling bröstfilé rå u. skinn'], ['kycklingbröst', 'Kyckling bröstfilé rå u. skinn'],
    ['laxfilé', 'Lax odlad Norge fjordlax rå'], ['ägg', 'Ägg rått'], ['äggulor', 'Äggula rå'], ['soja', 'Sojasås'], ['grädde', 'Vispgrädde fett 40%'],
    ['spaghetti', 'Pasta okokt'], ['lasagneplattor', 'Pasta okokt'], ['riven parmesan', 'Ost hårdost parmesan fett 30% typ Parmiggiano Reggiano'],
    ['jasminris', 'Ris jasmin okokt'], ['salt', 'Salt m. jod'], ['mjölk', 'Mjölk fett 3% berikad'], ['banan', 'Banan'], ['tomater', 'Tomat'],
    ['krossade tomater', 'Tomat krossad konserv. m. lag'], ['zucchini', 'Squash'], ['fetaost', 'Salladsost fett 22%'], ['citron', 'Citron'],
    ['skalade räkor', 'Räka kokt'], ['halloumi', 'Ost halloumi rå fett 22%'], ['isbergssallad', 'Isbergssallat'], ['röd paprika', 'Paprika röd'],
    ['potatis', 'Potatis kokt u. salt'], ['fast potatis', 'Potatis kokt u. salt'],
  ];
  for (const [ing, want] of cases) assert.equal(m(ing), want, ing);
});
