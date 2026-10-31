import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shoppingList, shoppingName } from '../src/lib/shopping.ts';
import type { Ingredient, Recipe } from '../src/lib/types.ts';

let id = 0;
const ing = (amount: number | null, unit: string, name: string, lv?: number): Ingredient => ({
  id: id++, recipe_id: '', position: 0, amount, unit, name, grams: null,
  lv_food_id: lv ?? null, lv_food_name: null, match_confidence: lv ? 'sure' : null,
});
const recipe = (name: string, ingredients: Ingredient[]) => ({ id: name, name, ingredients } as unknown as Recipe);

test('namnet på listan saknar beskrivning efter kommatecken och storlek', () => {
  assert.equal(shoppingName('Stor gul lök, hackad'), 'gul lök');
  assert.equal(shoppingName('Vitlöksklyftor (pressade)'), 'vitlöksklyftor');
});

test('samma vara från flera recept slås ihop och mängder summeras', () => {
  const list = shoppingList([
    recipe('Tacos', [ing(2, 'st', 'gul lök, hackad', 1), ing(400, 'g', 'nötfärs'), ing(1, 'dl', 'grädde'), ing(null, '', 'salt'), ing(2, 'dl', 'vatten')]),
    recipe('Gryta', [ing(1, 'st', 'lök', 1), ing(0.5, 'kg', 'nötfärs'), ing(3, 'msk', 'grädde'), ing(1, 'tsk', 'salt')]),
  ]);
  const by = (n: string) => list.find((x) => x.name === n)!;
  assert.equal(by('lök').amount, '3 st');
  assert.deepEqual(by('lök').recipes, ['Tacos', 'Gryta']);
  assert.equal(by('nötfärs').amount, '900 g');
  assert.equal(by('grädde').amount, '1,5 dl');
  assert.equal(by('salt').staple, true);
  assert.equal(by('salt').someUnmeasured, true);
  assert.ok(!list.some((x) => x.name === 'vatten'));
});

test('singular och plural blir samma vara, olika enheter visas båda', () => {
  const list = shoppingList([
    recipe('A', [ing(2, '', 'morötter'), ing(1, 'kg', 'potatis')]),
    recipe('B', [ing(1, '', 'morot'), ing(200, 'g', 'morot')]),
  ]);
  const m = list.find((x) => x.name === 'morot')!;
  assert.equal(m.amount, '3 st + 200 g');
  assert.equal(list.find((x) => x.name === 'potatis')!.amount, '1 kg');
});

test('örter i knippe köps och knippet blir enheten', () => {
  const [d] = shoppingList([recipe('Lax', [ing(1, '', 'knippe dill')])]);
  assert.equal(d.name, 'dill');
  assert.equal(d.amount, '1 knippe');
  assert.equal(d.staple, false);
});

test('olja, socker, mjöl, soja och sirap räknas som hemma, men inte mjölk eller sockerärtor', () => {
  const list = shoppingList([recipe('A', [
    ing(2, 'msk', 'olivolja'), ing(1, 'msk', 'rapsolja'), ing(null, '', 'olja, till stekning'), ing(1, 'dl', 'strösocker'),
    ing(3, 'dl', 'vetemjöl'), ing(1, 'msk', 'potatismjöl'), ing(2, 'msk', 'japansk soja'), ing(1, 'msk', 'sojasås'), ing(1, 'dl', 'ljus sirap'),
    ing(5, 'dl', 'mjölk'), ing(200, 'g', 'sockerärtor'), ing(4, 'dl', 'kokosmjölk'),
  ])]);
  const home = list.filter((x) => x.staple).map((x) => x.name);
  const buy = list.filter((x) => !x.staple).map((x) => x.name);
  assert.deepEqual(buy, ['mjölk', 'sockerärtor', 'kokosmjölk']);
  for (const n of ['olivolja', 'rapsolja', 'olja', 'strösocker', 'vetemjöl', 'potatismjöl', 'japansk soja', 'sojasås', 'ljus sirap']) assert.ok(home.includes(n), n);
});

test('intervall räknas med det större värdet i inköpslistan', () => {
  const [s] = shoppingList([recipe('A', [{ ...ing(1, 'msk', 'jordnötssmör'), amount_max: 2 }])]);
  assert.equal(s.amount, '2 msk');
});
