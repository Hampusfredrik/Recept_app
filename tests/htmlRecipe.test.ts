import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipeFromHtml } from '../supabase/functions/_shared/parse.ts';

// Påhittad bloggsida i WordPress-stil (inte kopierad från någon riktig sida).
const BLOG = `<html><head><title>Risotto</title><script>var x = "1 dl";</script></head><body>
<header><nav><ul><li>Hem</li><li>Recept</li></ul></nav></header>
<article><div class="entry-content">
<p>En krämig risotto som passar en höstkväll. Jag gjorde den i helgen.</p>
<h3>Pumparisotto</h3>
<p><strong>4 portioner</strong></p>
<p><strong>Ingredienser:</strong><br>
1 gul lök<br>
2 msk smör<br>
3 dl risottoris<br>
1 dl vitt vin<br>
ca 1 l grönsaksbuljong<br>
500 g pumpa<br>
salt och peppar</p>
<p><strong>Brynt salviasmör:</strong><br>50 g smör<br>10 salviablad</p>
<p>100 g getost</p>
<p><strong>Gör så här:</strong></p>
<p>Hacka löken och fräs den i smöret.</p>
<p>Tillsätt riset och vinet. Häll på buljongen lite i taget.</p>
<p>Bryn smöret med salvian och servera med getost.</p>
<p>Smaklig måltid!</p>
<div class="sharedaddy">Dela detta</div>
</div></article>
<footer><p>1 kommentar</p></footer></body></html>`;

test('blogg utan receptdata: ingredienser, steg och portioner hittas', () => {
  const r = recipeFromHtml(BLOG);
  assert.equal(r.portions, 4);
  assert.deepEqual(r.ingredients.map((i) => i.name), ['gul lök', 'smör', 'risottoris', 'vitt vin', 'grönsaksbuljong', 'pumpa', 'salt och peppar', 'smör', 'salviablad', 'getost']);
  assert.deepEqual(r.steps, [
    'Hacka löken och fräs den i smöret.',
    'Tillsätt riset och vinet. Häll på buljongen lite i taget.',
    'Bryn smöret med salvian och servera med getost.',
  ]);
});

test('utan rubriker: listan med mängder och numrerade steg', () => {
  const r = recipeFromHtml(`<article><p>Gott!</p><ul><li>400 g pasta</li><li>2 dl grädde</li><li>1 st citron</li></ul>
    <ol><li>1. Koka pastan enligt paketet.</li></ol><p>2. Blanda med grädden och citronen.</p></article>`);
  assert.deepEqual(r.ingredients.map((i) => i.name), ['pasta', 'grädde', 'citron']);
  assert.deepEqual(r.steps, ['Koka pastan enligt paketet.', 'Blanda med grädden och citronen.']);
});

// Samma uppbyggnad som en riktig blogg (tuvessonskan.se): ingen rubrik före
// ingredienserna, delrubrik "Servering" utan kolon, numrerade steg med delrubriker.
// Texten är påhittad.
test('lista direkt efter titeln, delrubriker utan kolon', () => {
  const r = recipeFromHtml(`<div class="entry-content clearfix"><p>Lång inledning om rätten. Den är god.</p>
    <h2>Pastagratäng</h2><p>1 burk tomater<br>200 g pasta<br>2 dl grädde<br>salt och peppar<br>olja, till stekning</p>
    <p><strong>Servering</strong><br>100 g fetaost<br>basilika</p>
    <h3>Såhär gör du</h3><p><strong>Sås</strong></p><p>1. Koka pastan.</p><p>2. Blanda allt och gratinera.</p>
    <p>Relaterade</p><p>Köp mina böcker här</p></div>`);
  assert.deepEqual(r.ingredients.map((i) => i.name), ['tomater', 'pasta', 'grädde', 'salt och peppar', 'olja, till stekning', 'fetaost', 'basilika']);
  assert.deepEqual(r.steps, ['Koka pastan.', 'Blanda allt och gratinera.']);
});
