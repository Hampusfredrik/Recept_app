import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standardPieceWeight } from '../src/data/pieceWeights.ts';

test('standardvikter träffar lök, morot och ägg men inte vitlök m.fl.', () => {
  for (const n of ['gul lök', 'gula lökar', 'lök', 'rödlök', 'röd lök', 'stor gul lök, hackad']) assert.equal(standardPieceWeight(n)?.grams, 100, n);
  for (const n of ['morot', 'morötter', 'stora morötter']) assert.equal(standardPieceWeight(n)?.grams, 80, n);
  for (const n of ['ägg', 'ägg, kokta']) assert.equal(standardPieceWeight(n)?.grams, 58, n);
  for (const n of ['vitlök', 'vitlöksklyftor', 'purjolök', 'salladslök', 'schalottenlök', 'äggula', 'äggvita', 'morotskaka']) assert.equal(standardPieceWeight(n), null, n);
});

import { isStockCube } from '../src/data/pieceWeights.ts';
test('buljongtärningar känns igen när de anges i styck', () => {
  assert.ok(isStockCube('grönsaksbuljongtärningar', ''));
  assert.ok(isStockCube('Hönsbuljongtärning', 'st'));
  assert.ok(!isStockCube('grönsaksbuljong', 'dl'));
  assert.ok(!isStockCube('buljongtärning', 'msk'));
});
