import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standardPieceWeight } from '../src/data/pieceWeights.ts';

test('standardvikter träffar lök, morot och ägg men inte vitlök m.fl.', () => {
  for (const n of ['gul lök', 'gula lökar', 'lök', 'rödlök', 'röd lök', 'stor gul lök, hackad']) assert.equal(standardPieceWeight(n)?.grams, 100, n);
  for (const n of ['morot', 'morötter', 'stora morötter']) assert.equal(standardPieceWeight(n)?.grams, 80, n);
  for (const n of ['ägg', 'ägg, kokta']) assert.equal(standardPieceWeight(n)?.grams, 58, n);
  for (const n of ['citron', 'citroner']) assert.equal(standardPieceWeight(n)?.grams, 125, n);
  // Andra lökar och äggets delar har egna vikter (Mattilsynet 2015), inte lökens eller äggets.
  assert.equal(standardPieceWeight('vitlöksklyftor')?.grams, 2.5);
  assert.equal(standardPieceWeight('purjolök')?.grams, 210);
  assert.equal(standardPieceWeight('salladslök')?.grams, 19);
  assert.equal(standardPieceWeight('äggula')?.grams, 18);
  assert.equal(standardPieceWeight('röd paprika')?.grams, 145);
  assert.equal(standardPieceWeight('tomater')?.grams, 95);
  for (const n of ['vitlök', 'morotskaka', 'citronsaft', 'citronskal', 'paprikapulver']) assert.equal(standardPieceWeight(n), null, n);
});

import { isStockCube } from '../src/data/pieceWeights.ts';
test('buljongtärningar känns igen när de anges i styck', () => {
  assert.ok(isStockCube('grönsaksbuljongtärningar', ''));
  assert.ok(isStockCube('Hönsbuljongtärning', 'st'));
  assert.ok(!isStockCube('grönsaksbuljong', 'dl'));
  assert.ok(!isStockCube('buljongtärning', 'msk'));
});

import { standardCanWeight } from '../src/data/pieceWeights.ts';
test('burkvikter', () => {
  assert.equal(standardCanWeight('krossade tomater')?.grams, 400);
  assert.equal(standardCanWeight('kidneybönor')?.grams, 230);
  assert.equal(standardCanWeight('svarta bönor')?.grams, 230);
  assert.equal(standardCanWeight('kikärtor')?.grams, 230);
  assert.equal(standardCanWeight('majs')?.grams, 200);
  assert.equal(standardCanWeight('kokosmjölk'), null);
});
