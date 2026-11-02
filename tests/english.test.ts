import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forNutrition, isEnglish, toSwedish } from '../src/lib/english.ts';
import { parseIngredientLine } from '../supabase/functions/_shared/parse.ts';
import type { Ingredient } from '../src/lib/types.ts';

const ings = (lines: string[]) => lines.map((l, k) => ({ id: k, recipe_id: '', position: k, ...parseIngredientLine(l), grams: null,
  lv_food_id: null, lv_food_name: null, match_confidence: null }) as Ingredient);

test('engelska namn översätts för matchningen', () => {
  assert.equal(toSwedish('boneless skinless chicken thighs'), 'kycklinglårfilé');
  assert.equal(toSwedish('extra virgin olive oil'), 'olivolja');
  assert.equal(toSwedish('large yellow onion, diced'), 'gul lök');
  assert.equal(toSwedish('ground cumin'), 'spiskummin');
  assert.equal(toSwedish('paprika'), 'paprikapulver');
  assert.equal(toSwedish('red bell pepper, sliced'), 'paprika');
  assert.equal(toSwedish('garlic cloves, minced'), 'vitlöksklyfta');
  assert.equal(toSwedish('unobtainium'), null);
});

test('svenska recept lämnas orörda, engelska känns igen', () => {
  const sv = ings(['1 gul lök', '2 msk olivolja', '400 g nötfärs', '1 tsk paprikapulver', 'salt']);
  assert.equal(isEnglish(sv), false);
  assert.equal(forNutrition(sv), sv);
  assert.equal(isEnglish(ings(['1 lb ground beef', '2 tbsp olive oil', '1 onion', 'salt'])), true);
});

test('amerikanska mått och burkvikter räknas om, texten i receptet ändras inte', () => {
  const src = ings(['1 (28 oz) can crushed tomatoes', '2 cups all-purpose flour', '1 stick butter', '3 cloves garlic']);
  const [tom, flour, butter, garlic] = forNutrition(src);
  assert.deepEqual([tom.amount, tom.unit, tom.name], [28, 'oz', 'krossade tomater']);
  assert.deepEqual([flour.amount, flour.unit, flour.name], [2, 'cup', 'vetemjöl']);
  assert.deepEqual([butter.amount, butter.unit, butter.name], [4, 'oz', 'smör']);
  assert.deepEqual([garlic.amount, garlic.unit, garlic.name], [3, 'st', 'vitlöksklyfta']);
  assert.equal(src[1].name, 'all-purpose flour');
  assert.equal(src[1].unit, 'cups');
});
