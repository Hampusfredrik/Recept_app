// Engelska recept: receptet visas som det skrevs, men näringsberäkningen läser
// ingredienserna på svenska så att de går att koppla till Livsmedelsverkets databas.
// Ordlistan är appens egen översättning, inte en uppgift från Livsmedelsverket.
import type { Ingredient } from './types.ts';

// [engelska namn, svenskt namn som matchas mot databasen]
const DICT: [string[], string][] = [
  // Kött och fågel
  [['ground beef', 'minced beef', 'beef mince', 'lean ground beef'], 'nötfärs'],
  [['ground pork', 'minced pork', 'pork mince'], 'fläskfärs'],
  [['ground lamb', 'minced lamb', 'lamb mince'], 'lammfärs'],
  [['ground meat', 'mince'], 'blandfärs'],
  [['chicken breast', 'chicken breasts', 'chicken breast fillet', 'chicken fillet', 'boneless skinless chicken breast'], 'kycklingfilé'],
  [['chicken thigh', 'chicken thighs', 'boneless skinless chicken thighs', 'chicken thigh fillet'], 'kycklinglårfilé'],
  [['chicken'], 'kyckling'],
  [['turkey breast', 'turkey'], 'kalkonfilé'],
  [['pork tenderloin', 'pork fillet'], 'fläskfilé'],
  [['pork chop', 'pork chops'], 'fläskkotlett'],
  [['bacon', 'streaky bacon'], 'bacon'],
  [['pancetta'], 'bacon'],
  // Fisk och skaldjur
  [['salmon', 'salmon fillet', 'salmon fillets'], 'lax'],
  [['cod', 'cod fillet', 'cod fillets', 'white fish'], 'torsk'],
  [['shrimp', 'prawns', 'prawn', 'shrimps'], 'räkor'],
  [['tuna', 'canned tuna', 'tinned tuna'], 'tonfisk'],
  [['mussels'], 'blåmusslor'],
  // Ägg och mejeri
  [['egg', 'eggs', 'large egg', 'large eggs'], 'ägg'],
  [['egg yolk', 'egg yolks'], 'äggula'],
  [['egg white', 'egg whites'], 'äggvita'],
  [['milk', 'whole milk'], 'mjölk'],
  [['skim milk', 'skimmed milk'], 'lättmjölk'],
  [['heavy cream', 'heavy whipping cream', 'double cream', 'whipping cream', 'cream'], 'grädde'],
  [['single cream', 'light cream', 'cooking cream', 'half and half'], 'matlagningsgrädde'],
  [['sour cream'], 'gräddfil'],
  [['greek yogurt', 'greek yoghurt'], 'grekisk yoghurt'],
  [['yogurt', 'yoghurt', 'plain yogurt', 'natural yogurt'], 'yoghurt'],
  [['butter', 'unsalted butter', 'salted butter'], 'smör'],
  [['cheese', 'cheddar', 'cheddar cheese', 'gruyere', 'gruyère', 'shredded cheese', 'grated cheese'], 'ost'],
  [['parmesan cheese', 'parmesan', 'parmigiano reggiano'], 'parmesan'],
  [['mozzarella cheese', 'mozzarella'], 'mozzarella'],
  [['feta cheese', 'feta'], 'fetaost'],
  [['goat cheese', "goat's cheese", 'goats cheese'], 'chèvre'],
  [['cream cheese'], 'färskost'],
  [['cottage cheese'], 'keso'],
  [['ricotta', 'ricotta cheese'], 'ricotta'],
  [['blue cheese', 'gorgonzola'], 'ädelost'],
  // Skafferi
  [['all-purpose flour', 'all purpose flour', 'plain flour', 'flour', 'bread flour', 'self-raising flour', 'self-rising flour'], 'vetemjöl'],
  [['cornstarch', 'cornflour', 'corn starch'], 'majsstärkelse'],
  [['potato starch'], 'potatismjöl'],
  [['sugar', 'granulated sugar', 'caster sugar', 'white sugar'], 'socker'],
  [['brown sugar', 'light brown sugar', 'dark brown sugar'], 'farinsocker'],
  [['powdered sugar', 'icing sugar', "confectioners' sugar", 'confectioners sugar'], 'florsocker'],
  [['honey'], 'honung'],
  [['maple syrup'], 'lönnsirap'],
  [['baking powder'], 'bakpulver'],
  [['baking soda', 'bicarbonate of soda'], 'bikarbonat'],
  [['yeast', 'dry yeast', 'active dry yeast', 'instant yeast'], 'torrjäst'],
  [['salt', 'kosher salt', 'table salt'], 'salt'],
  [['sea salt', 'flaky salt', 'flaky sea salt'], 'flingsalt'],
  [['black pepper', 'pepper', 'ground black pepper', 'freshly ground black pepper', 'white pepper'], 'svartpeppar'],
  [['olive oil', 'extra virgin olive oil', 'extra-virgin olive oil'], 'olivolja'],
  [['canola oil', 'rapeseed oil'], 'rapsolja'],
  [['vegetable oil', 'sunflower oil', 'neutral oil', 'oil', 'cooking oil'], 'matolja'],
  [['sesame oil', 'toasted sesame oil'], 'sesamolja'],
  [['coconut oil'], 'kokosolja'],
  [['vinegar', 'white vinegar', 'white wine vinegar', 'red wine vinegar', 'rice vinegar', 'balsamic vinegar'], 'vinäger'],
  [['apple cider vinegar', 'cider vinegar'], 'äppelcidervinäger'],
  [['soy sauce', 'light soy sauce', 'dark soy sauce', 'tamari'], 'sojasås'],
  [['fish sauce'], 'fisksås'],
  [['dijon mustard', 'dijon', 'mustard'], 'fransk senap'],
  [['mayonnaise', 'mayo'], 'majonnäs'],
  [['ketchup'], 'ketchup'],
  [['tomato paste', 'tomato purée', 'tomato puree'], 'tomatpuré'],
  [['canned tomatoes', 'diced tomatoes', 'crushed tomatoes', 'chopped tomatoes', 'tinned tomatoes', 'whole peeled tomatoes', 'passata', 'tomato sauce'], 'krossade tomater'],
  [['coconut milk', 'coconut cream'], 'kokosmjölk'],
  [['chicken broth', 'chicken stock'], 'hönsbuljong'],
  [['beef broth', 'beef stock'], 'köttbuljong'],
  [['vegetable broth', 'vegetable stock', 'broth', 'stock'], 'grönsaksbuljong'],
  [['stock cube', 'stock cubes', 'bouillon cube', 'bouillon cubes'], 'buljongtärning'],
  [['rice', 'white rice', 'long grain rice', 'long-grain rice'], 'ris'],
  [['basmati rice'], 'basmatiris'],
  [['jasmine rice'], 'jasminris'],
  [['arborio rice', 'risotto rice', 'arborio'], 'risottoris'],
  [['pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'rigatoni', 'macaroni', 'fusilli', 'lasagna noodles', 'lasagne sheets'], 'pasta'],
  [['noodles', 'egg noodles', 'rice noodles', 'glass noodles'], 'nudlar'],
  [['breadcrumbs', 'bread crumbs', 'panko', 'panko breadcrumbs'], 'ströbröd'],
  [['oats', 'rolled oats', 'oatmeal'], 'havregryn'],
  [['quinoa'], 'quinoa'],
  [['couscous'], 'couscous'],
  [['lentils', 'red lentils', 'green lentils', 'brown lentils'], 'linser'],
  [['chickpeas', 'garbanzo beans', 'canned chickpeas'], 'kikärtor'],
  [['black beans'], 'svarta bönor'],
  [['kidney beans', 'red kidney beans'], 'kidneybönor'],
  [['corn', 'sweetcorn', 'sweet corn', 'corn kernels'], 'majs'],
  [['peanut butter'], 'jordnötssmör'],
  [['peanuts'], 'jordnötter'],
  [['almonds', 'almond'], 'mandel'],
  [['walnuts', 'walnut'], 'valnötter'],
  [['cashews', 'cashew nuts', 'cashew'], 'cashewnötter'],
  [['sesame seeds'], 'sesamfrö'],
  [['cocoa powder', 'cocoa'], 'kakao'],
  [['tortillas', 'tortilla', 'flour tortillas'], 'tortillabröd'],
  [['white wine', 'dry white wine'], 'vitt vin'],
  [['red wine', 'dry red wine'], 'rött vin'],
  [['water', 'cold water', 'warm water', 'boiling water', 'hot water', 'ice'], 'vatten'],
  // Grönsaker och frukt
  [['onion', 'onions', 'yellow onion', 'yellow onions', 'white onion', 'brown onion'], 'gul lök'],
  [['red onion', 'red onions'], 'rödlök'],
  [['shallot', 'shallots'], 'schalottenlök'],
  [['green onion', 'green onions', 'scallion', 'scallions', 'spring onion', 'spring onions'], 'salladslök'],
  [['garlic', 'garlic clove', 'garlic cloves', 'clove garlic', 'cloves garlic', 'cloves of garlic', 'clove of garlic'], 'vitlöksklyfta'],
  [['ginger', 'fresh ginger', 'ginger root'], 'ingefära'],
  [['carrot', 'carrots'], 'morot'],
  [['potato', 'potatoes'], 'potatis'],
  [['sweet potato', 'sweet potatoes'], 'sötpotatis'],
  [['tomato', 'tomatoes'], 'tomat'],
  [['cherry tomatoes', 'grape tomatoes', 'cherry tomato'], 'körsbärstomater'],
  [['bell pepper', 'bell peppers', 'red bell pepper', 'red pepper', 'red peppers', 'capsicum'], 'paprika'],
  [['green bell pepper', 'green pepper'], 'grön paprika'],
  [['yellow bell pepper', 'yellow pepper'], 'gul paprika'],
  [['chili', 'chilli', 'chile', 'red chili', 'green chili', 'jalapeño', 'jalapeno', 'chili pepper', 'chilli pepper'], 'chilipeppar'],
  [['cucumber'], 'gurka'],
  [['zucchini', 'courgette', 'courgettes'], 'zucchini'],
  [['eggplant', 'aubergine'], 'aubergine'],
  [['broccoli'], 'broccoli'],
  [['cauliflower'], 'blomkål'],
  [['spinach', 'baby spinach'], 'spenat'],
  [['kale'], 'grönkål'],
  [['lettuce', 'iceberg lettuce'], 'isbergssallad'],
  [['arugula', 'rocket'], 'ruccola'],
  [['cabbage', 'white cabbage', 'green cabbage'], 'vitkål'],
  [['red cabbage'], 'rödkål'],
  [['mushrooms', 'mushroom', 'button mushrooms', 'cremini mushrooms'], 'champinjoner'],
  [['celery', 'celery stalk', 'celery stalks'], 'stjälkselleri'],
  [['leek', 'leeks'], 'purjolök'],
  [['peas', 'green peas', 'frozen peas'], 'gröna ärter'],
  [['asparagus'], 'sparris'],
  [['avocado', 'avocados'], 'avokado'],
  [['lemon', 'lemons'], 'citron'],
  [['lime', 'limes'], 'lime'],
  [['lemon juice', 'juice of lemon', 'fresh lemon juice'], 'citronsaft'],
  [['lime juice', 'juice of lime', 'fresh lime juice'], 'limesaft'],
  [['orange', 'oranges'], 'apelsin'],
  [['apple', 'apples'], 'äpple'],
  [['banana', 'bananas'], 'banan'],
  [['blueberries'], 'blåbär'],
  [['strawberries'], 'jordgubbar'],
  [['raspberries'], 'hallon'],
  [['pumpkin', 'butternut squash', 'squash'], 'pumpa'],
  [['beets', 'beetroot', 'beet'], 'rödbetor'],
  // Örter och kryddor (kryddor räknas inte i näringsvärdet)
  [['parsley', 'flat-leaf parsley', 'fresh parsley'], 'persilja'],
  [['cilantro', 'fresh coriander', 'coriander leaves'], 'koriander'],
  [['basil', 'fresh basil'], 'basilika'],
  [['dill', 'fresh dill'], 'dill'],
  [['mint', 'fresh mint', 'mint leaves'], 'mynta'],
  [['chives'], 'gräslök'],
  [['thyme', 'fresh thyme', 'dried thyme'], 'timjan'],
  [['rosemary'], 'rosmarin'],
  [['oregano', 'dried oregano'], 'oregano'],
  [['sage', 'sage leaves'], 'salvia'],
  [['bay leaf', 'bay leaves'], 'lagerblad'],
  [['cumin', 'ground cumin', 'cumin seeds'], 'spiskummin'],
  [['paprika', 'smoked paprika', 'sweet paprika'], 'paprikapulver'],
  [['chili powder', 'chilli powder'], 'chilipulver'],
  [['red pepper flakes', 'chili flakes', 'chilli flakes', 'crushed red pepper'], 'chiliflakes'],
  [['cayenne', 'cayenne pepper'], 'cayennepeppar'],
  [['cinnamon', 'ground cinnamon'], 'kanel'],
  [['nutmeg'], 'muskot'],
  [['turmeric', 'ground turmeric'], 'gurkmeja'],
  [['curry powder'], 'curry'],
  [['garam masala'], 'garam masala'],
  [['cardamom'], 'kardemumma'],
  [['ground ginger'], 'ingefärspulver'],
  [['ground coriander', 'coriander'], 'korianderpulver'],
  [['cloves', 'ground cloves', 'whole cloves'], 'kryddnejlika'],
  [['vanilla extract', 'vanilla', 'vanilla essence'], 'vaniljpulver'],
];

// Ord som är likadana på svenska och engelska och därför inte visar att receptet är engelskt.
const SAME_IN_SWEDISH = new Set(['salt', 'pasta', 'spaghetti', 'penne', 'linguine', 'rigatoni', 'fusilli', 'bacon', 'parmesan', 'mozzarella', 'feta', 'ricotta', 'gorgonzola',
  'quinoa', 'couscous', 'ketchup', 'lime', 'dill', 'oregano', 'broccoli', 'zucchini', 'aubergine', 'curry', 'garam masala', 'chili', 'tortilla', 'tortillas', 'panko']);

// Beskrivningar som tas bort före översättningen.
const DESCRIPTORS = new Set(['chopped', 'finely', 'roughly', 'coarsely', 'thinly', 'diced', 'minced', 'sliced', 'grated', 'shredded', 'crushed', 'peeled', 'fresh', 'freshly',
  'large', 'medium', 'small', 'big', 'about', 'approximately', 'optional', 'divided', 'packed', 'heaping', 'level', 'room', 'temperature', 'softened', 'melted', 'cold',
  'cubed', 'halved', 'quartered', 'trimmed', 'rinsed', 'drained', 'and', 'or', 'to', 'taste', 'for', 'serving', 'garnish', 'of', 'a', 'an', 'the', 'plus', 'more', 'extra', 'few',
  'boneless', 'skinless', 'organic', 'whole', 'ripe', 'dried', 'ground', 'lean', 'cooked', 'uncooked', 'raw', 'frozen', 'canned', 'tinned', 'can', 'cans', 'tin', 'tins', 'jar']);

const KEYS = DICT.flatMap(([names, sv]) => names.map((n) => ({ n, sv, words: n.split(' ').length })))
  .sort((a, b) => b.words - a.words || b.n.length - a.n.length);

const clean = (name: string) => name.toLowerCase().normalize('NFC')
  .replace(/\([^)]*\)/g, ' ').split(/,| - | – |;/)[0]
  .replace(/[^a-zà-ÿ'\- ]/g, ' ').replace(/\s+/g, ' ').trim();

const hasPhrase = (text: string, phrase: string) =>
  new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?(\\s|$)`).test(text);

/** Svenskt namn för en engelsk ingrediens, eller null om ordlistan inte känner igen den. */
export function toSwedish(name: string): string | null {
  const t = clean(name);
  if (!t) return null;
  // Först med beskrivningarna kvar (så att "ground cumin" och "dried thyme" träffar), sedan utan.
  const bare = t.split(' ').filter((w) => !DESCRIPTORS.has(w)).join(' ');
  for (const text of [t, bare]) {
    for (const k of KEYS) if (hasPhrase(text, k.n)) return k.sv;
  }
  return null;
}

// Engelska mått → svenska (amerikanska mått: 1 cup = 236,6 ml, 1 tbsp = 14,8 ml, 1 tsp = 4,9 ml,
// 1 oz = 28,35 g, 1 lb = 453,6 g enligt NIST:s definitioner av US customary units).
const UNIT_MAP: Record<string, string> = {
  cup: 'cup', cups: 'cup', c: 'cup', tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbs: 'tbsp', tbl: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp', ounce: 'oz', ounces: 'oz', oz: 'oz', pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  can: 'burk', cans: 'burk', tin: 'burk', tins: 'burk', clove: 'st', cloves: 'st', piece: 'st', pieces: 'st', whole: 'st',
  pinch: 'nypa', pinches: 'nypa', bunch: 'knippe', bunches: 'knippe', package: 'paket', packages: 'paket', pkg: 'paket', stick: 'stick', sticks: 'stick',
};
const ENGLISH_UNITS = new Set(Object.keys(UNIT_MAP).filter((u) => !['c', 'whole'].includes(u)));

/** Ser receptet ut att vara på engelska? Engelska mått, eller flera ingredienser som bara finns i den engelska ordlistan. */
export function isEnglish(ings: Pick<Ingredient, 'name' | 'unit'>[]): boolean {
  if (!ings.length) return false;
  const units = ings.filter((i) => ENGLISH_UNITS.has(i.unit.toLowerCase()) || ENGLISH_UNITS.has(clean(i.name).split(' ')[0])).length;
  const words = ings.filter((i) => {
    const t = clean(i.name);
    const k = KEYS.find((x) => hasPhrase(t, x.n));
    return !!k && !SAME_IN_SWEDISH.has(k.n);
  }).length;
  return units >= 2 || words >= Math.max(2, Math.ceil(ings.length * 0.3));
}

/**
 * Ingredienserna som näringsberäkningen ska läsa: oförändrade för svenska recept, och med
 * svenska namn och mått för engelska. Id:n behålls, så att kopplingarna till livsmedel gäller.
 */
export function forNutrition<T extends Ingredient>(ings: T[]): T[] {
  if (!isEnglish(ings)) return ings;
  return ings.map((i) => {
    let unit = i.unit.toLowerCase().trim();
    let name = i.name;
    let amount = i.amount;
    // Måttet hamnade i namnet vid importen ("2 cups flour" → namn "cups flour").
    if (!unit) {
      const first = clean(name).split(' ')[0];
      if (UNIT_MAP[first] && first !== 'c') { unit = first; name = name.replace(/^\s*\(?[^\s]+\)?\s*/, ''); }
    }
    let u = UNIT_MAP[unit] ?? unit;
    // "1 (28 oz) can tomatoes", "1 can (14 oz) coconut milk": vikten i parentesen gäller.
    const size = /\((\d+(?:[.,]\d+)?)\s*-?\s*(oz|ounces?|g|grams?|ml|lb|lbs?)\.?\s*(can|cans|tin|tins|package|packages|jar|jars)?\)/i.exec(i.name);
    if (size && ['burk', 'paket', 'st', ''].includes(u) && amount != null) {
      const n = parseFloat(size[1].replace(',', '.'));
      const su = size[2].toLowerCase();
      const per = su.startsWith('oz') || su.startsWith('ounce') ? 'oz' : su.startsWith('lb') ? 'lb' : su.startsWith('g') ? 'g' : 'ml';
      amount = amount * n;
      u = per;
      name = name.replace(size[0], ' ');
    }
    // 1 stick butter = 1/2 cup = 4 oz (amerikanskt standardmått).
    if (u === 'stick') { u = 'oz'; amount = amount == null ? null : amount * 4; }
    const sv = toSwedish(name);
    return { ...i, name: sv ?? name, unit: u, amount, amount_max: i.amount_max != null && u === 'oz' && unit.startsWith('stick') ? i.amount_max * 4 : i.amount_max };
  });
}
