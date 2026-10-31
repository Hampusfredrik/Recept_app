import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchFood } from '../src/lib/match.ts';

// Livsmedelsnamnen i bilden från appen, plus namn i samma stil som kandidater.
// De extra namnen är testdata för rangordningen, inte verifierade namn ur databasen.
const names = [
  'Gula ärtor kokta m. salt', 'Ärtor gula torkade', 'Vattenkastanj rå', 'Vatten kranvatten', 'Saltsill rå', 'Salt',
  'Lök gul', 'Lök röd', 'Vitlök', 'Purjolök', 'Agar torkad', 'Grönsakssufflé', 'Buljongtärning grönsak',
  'Gris sidfläsk el. stekfläsk rimmat stekt', 'Kyckling bröstfilé rå', 'Torsk filé rå', 'Morot rå', 'Mjölk standard 3% fett',
  'Filmjölk', 'Grädde vispgrädde 40%', 'Vispgrädde', 'Ägg', 'Äggula', 'Potatis rå', 'Potatis kokt', 'Potatis stekt', 'Potatismos', 'Krossade tomater konserv', 'Tomat',
];
const foods = names.map((name, id) => ({ id, name }));
const m = (s: string) => matchFood(s, foods)?.food.name ?? null;

test('huvudordet måste finnas i ingrediensen', () => {
  assert.equal(m('salt'), 'Salt');
  assert.equal(m('liter vatten'), 'Vatten kranvatten');
  assert.equal(m('torkad mejram'), null);
  assert.equal(m('torkad timjan'), null);
});

test('böjningar och sammansatta ord', () => {
  assert.equal(m('torkade gula ärter'), 'Ärtor gula torkade');
  assert.equal(m('gula lökar'), 'Lök gul');
  assert.equal(m('grönsaksbuljongtärningar'), 'Buljongtärning grönsak');
  assert.equal(m('kycklingfilé'), 'Kyckling bröstfilé rå');
  assert.equal(m('morötter'), 'Morot rå');
});

test('lök blir inte vitlök eller purjolök', () => {
  assert.equal(m('vitlöksklyftor'), 'Vitlök');
  assert.equal(m('rödlök'), 'Lök röd');
  assert.equal(m('gul lök'), 'Lök gul');
});

test('beskrivningar i parentes ignoreras', () => {
  assert.equal(m('rimmat fläsk (kan uteslutas)'), 'Gris sidfläsk el. stekfläsk rimmat stekt');
});

test('vanliga basvaror', () => {
  assert.equal(m('mjölk'), 'Mjölk standard 3% fett');
  assert.equal(m('vispgrädde'), 'Vispgrädde');
  assert.equal(m('ägg'), 'Ägg');
  assert.equal(m('potatis'), 'Potatis kokt');
  assert.equal(m('fast potatis'), 'Potatis kokt');
  assert.equal(m('stekt potatis'), 'Potatis stekt');
  assert.equal(m('potatismos'), 'Potatismos');
  assert.equal(m('krossade tomater'), 'Krossade tomater konserv');
  assert.equal(m('torskfilé'), 'Torsk filé rå');
});

test('namn som börjar med ett beskrivande ord', () => {
  const list = ['Gula ärtor kokta m. salt', 'Gula ärtor torkade', 'Ärtor morot stuvade', 'Gröna ärtor frysta'].map((name, id) => ({ id, name }));
  assert.equal(matchFood('torkade gula ärter', list)?.food.name, 'Gula ärtor torkade');
  assert.equal(matchFood('gröna ärter', list)?.food.name, 'Gröna ärtor frysta');
});
