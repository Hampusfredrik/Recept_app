import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessUse, parseIngredientLine, parseRaw, parseYield } from '../supabase/functions/_shared/parse.ts';
import { lastLabel } from '../src/lib/dates.ts';

// Exempeltexten från prototypen (två spalter från Live Text).
const CLIP_1 = 'Kycklinggryta med\naprikoser\n4 portioner\nIngredienser\n600 g kycklinglårfilé\n1 gul lök\n2 vitlöksklyftor\n1 msk rapsolja\n2 tsk spiskummin\n1 burk krossade tomater\n1 dl torkade aprikoser\n2 dl vatten';
const CLIP_2 = 'Gör så här\n1. Skär kycklingen i bitar och\nbryn den i oljan i en gryta.\n2. Hacka lök och vitlök. Fräs med\nspiskummin tills löken mjuknat.\n3. Tillsätt tomater, aprikoser och\nvatten. Låt puttra under lock i 25 minuter.\n4. Servera med couscous och färsk koriander.\n147';

test('parseRaw sorterar Live Text enligt reglerna', () => {
  const p = parseRaw(CLIP_1 + '\n' + CLIP_2);
  assert.equal(p.name, 'Kycklinggryta med aprikoser');
  assert.equal(p.portions, 4);
  assert.equal(p.page, '147');
  assert.equal(p.lines.filter((l) => l.kind === 'ingr').length, 8);
  const steps = p.lines.filter((l) => l.kind === 'step').map((l) => l.text);
  assert.deepEqual(steps, [
    'Skär kycklingen i bitar och bryn den i oljan i en gryta.',
    'Hacka lök och vitlök. Fräs med spiskummin tills löken mjuknat.',
    'Tillsätt tomater, aprikoser och vatten. Låt puttra under lock i 25 minuter.',
    'Servera med couscous och färsk koriander.',
  ]);
});

test('parseIngredientLine', () => {
  assert.deepEqual(parseIngredientLine('400 g torskfilé'), { amount: 400, unit: 'g', name: 'torskfilé' });
  assert.deepEqual(parseIngredientLine('1 gul lök'), { amount: 1, unit: '', name: 'gul lök' });
  assert.deepEqual(parseIngredientLine('0,5 g saffran'), { amount: 0.5, unit: 'g', name: 'saffran' });
  assert.deepEqual(parseIngredientLine('½ dl grädde'), { amount: 0.5, unit: 'dl', name: 'grädde' });
  assert.deepEqual(parseIngredientLine('1 kruka dill'), { amount: 1, unit: 'kruka', name: 'dill' });
  assert.deepEqual(parseIngredientLine('salt och peppar'), { amount: null, unit: '', name: 'salt och peppar' });
  assert.deepEqual(parseIngredientLine('2 lime'), { amount: 2, unit: '', name: 'lime' });
  assert.deepEqual(parseIngredientLine('1,5 liter vatten'), { amount: 1.5, unit: 'l', name: 'vatten' });
  assert.deepEqual(parseIngredientLine('2 matskedar olja'), { amount: 2, unit: 'msk', name: 'olja' });
  assert.deepEqual(parseIngredientLine('2 lökar'), { amount: 2, unit: '', name: 'lökar' });
  assert.deepEqual(parseIngredientLine('1 gurka'), { amount: 1, unit: '', name: 'gurka' });
  assert.deepEqual(parseIngredientLine('1 l mjölk'), { amount: 1, unit: 'l', name: 'mjölk' });
});

test('guessUse kopplar steg till ingredienser', () => {
  const names = ['torskfilé', 'skalade räkor', 'gul lök', 'vitlöksklyftor', 'morot'];
  // Ord kortare än 4 tecken (”lök”) räknas inte; ”Skala” matchar ”skalade” på de fem första tecknen.
  assert.deepEqual(guessUse('Hacka lök och vitlök fint. Skala och skär moroten i tunna skivor.', names), [1, 3, 4]);
  assert.deepEqual(guessUse('Vänd ner räkorna precis innan servering.', names), [1]);
});

test('parseYield', () => {
  assert.equal(parseYield('4 portioner'), 4);
  assert.equal(parseYield(['6', '6 servings']), 6);
  assert.equal(parseYield(2), 2);
  assert.equal(parseYield(undefined), null);
});

test('lastLabel följer etiketterna i README', () => {
  assert.equal(lastLabel(null), 'Aldrig lagad');
  assert.equal(lastLabel(0), 'Lagad idag');
  assert.equal(lastLabel(1), 'Lagad igår');
  assert.equal(lastLabel(12), 'Lagad för 12 dagar sedan');
  assert.equal(lastLabel(30), 'Lagad för 4 veckor sedan');
  assert.equal(lastLabel(200), 'Lagad för 7 månader sedan');
});
