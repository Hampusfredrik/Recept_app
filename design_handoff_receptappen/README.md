# Handoff: Receptappen (webbapp för två)

## Översikt
En receptapp för två personer (användaren och partnern) som delar samma receptsamling i realtid. Man sparar recept från webblänkar eller kokböcker, graderar insats 1–5, taggar, planerar veckan, får förslag, bockar av ingredienser, skriver anteckningar och ser näringsvärde beräknat mot Livsmedelsverkets livsmedelsdatabas.

Allt UI är på **svenska**. Målplattform: **iPhone via Safari**, installerad på hemskärmen som PWA.

## Om designfilerna
Filerna i `prototyp/` är **designreferenser byggda i HTML**: klickbara prototyper som visar utseende och beteende. De är inte produktionskod. Uppgiften är att **bygga om designen** i en riktig kodbas. Repot `Hampusfredrik/Recept_app` är tomt, så välj stack enligt nedan.

Öppna `prototyp/Receptappen.dc.html` i en webbläsare för att se alla skärmar. Omgång 3 (överst) och 2 är de aktuella. Omgång 1 innehåller tidigare visuella riktningar; **riktning 1a med listvy** är den valda.

## Fidelity
**High-fidelity.** Färger, typografi, radier och layout är slutgiltiga. Bygg om dem pixelnära med tokens nedan. Platshållarbilderna (randiga ytor) ersätts med riktiga bilder.

## Rekommenderad stack (allt gratis)
- **Frontend:** React + Vite + TypeScript, PWA (manifest + service worker, `display: standalone`, ikoner, `apple-mobile-web-app-capable`).
- **Backend/synk:** Supabase gratisnivå: Postgres, Auth (e-post med magisk länk), Realtime för live-synk, Storage för bilder.
- **Hosting:** Vercel eller Netlify (gratis).
- **Serverfunktion för länkimport:** Vercel/Netlify Function eller Supabase Edge Function.
- **OCR-reserv:** Tesseract.js med språk `swe`, körs i webbläsaren.
- **Näring:** Livsmedelsverkets öppna API för livsmedelsdatabasen (se dataportal.livsmedelsverket.se). Verifiera aktuella endpoints. Cacha livsmedelsdata i en egen tabell.

### Delning mellan två personer
- Tabell `households` (ett "kök") och `household_members (household_id, user_id)`.
- Alla data har `household_id`. Row Level Security: en användare får läsa och skriva rader där hen är medlem.
- Inbjudan: skapa en kod/länk som partnern öppnar efter inloggning för att gå med i köket.
- Realtime-prenumeration på recept, plan, avbockningar och anteckningar så att ändringar syns direkt hos den andra.

## Datamodell (förslag)
```
recipes
  id, household_id, name, effort (1–5), portions (int),
  source_type ('web'|'book'),
  url, domain, fetched_at,            -- web
  book_title, page,                    -- book
  image_url, created_at, last_cooked_on (date, null = aldrig)
recipe_ingredients
  id, recipe_id, position, amount (numeric|null), unit, name,
  lv_food_id (Livsmedelsverket-id|null), lv_food_name, match_confidence ('sure'|'unsure')
recipe_steps
  id, recipe_id, position, text, ingredient_ids (int[])   -- vilka ingredienser steget använder
tags            id, household_id, name, tone ('accent'|'sage'|'sand'|'clay')
recipe_tags     recipe_id, tag_id
notes           recipe_id, text, updated_at, updated_by    -- en delad anteckning per recept
checked_items   recipe_id, ingredient_id                   -- delad avbockning (återställs vid "Lagade idag")
week_plan       household_id, date, recipe_id              -- en middag per dag
pantry_items    household_id, name                         -- för "Vad kan jag laga?"
lv_foods        id, name, per_100g jsonb                   -- cache av Livsmedelsverkets värden
```
Insatsetiketter: 1 Superlätt, 2 Lätt, 3 Medel, 4 Lite mer att göra, 5 Helgprojekt.
**Ingen tidsangivelse** (tid i minuter) visas eller sparas.

## Navigering
Flytande flikrad längst ner (mörk pill, `--color-neutral-900`, höjd 66, radie 999, `--shadow-lg`, 16 px från kanterna, 30 px från botten):
**Idag · Recept · [+] · Veckan · Taggar.** Plus-knappen i mitten är en cirkel på 54 px i `--color-accent` och öppnar arket "Lägg till recept". Aktiv flik har ikon och text i `--color-accent-300`, inaktiv i `--color-neutral-400`. Flikraden visas på Idag, Recept, Veckan och Taggar, inte på receptsidan eller i lägg-till-flöden.

Generellt: skärmens padding är 62 px upptill (under statusraden) och 20 px på sidorna. Skärmrubriken har en kicker (12 px, versaler, spärrning 0.1em, `--color-accent-700`, 600) och under den en H1 på 38 px i Caprasimo.

## Skärmar

### 1. Idag (startsida), prototyp 3a
- Kicker med veckodag och datum, t.ex. "Fredag 30 oktober". H1: "Vad blir det idag?"
- **Planerat idag** (om veckoplanen har ett recept idag): salviefärgad rad (`--color-accent-2-100`) med kalenderikon, tryck öppnar receptet.
- **Länge sedan sist**, ett stort kort (`--color-surface`, radie 34): bild 190 px hög med etiketten "Länge sedan sist" i en pill; namn (24 px Caprasimo), insatsikoner, "Lagad för 6 månader sedan". Knapparna "Visa receptet" (primär) och "Lägg i veckan" (sekundär). Den sistnämnda lägger receptet på första tomma dagen från idag och framåt, och visar sedan "I veckan ✓".
  - Urval: receptet med störst antal dagar sedan `last_cooked_on`. Aldrig lagade räknas som längst. Recept som redan finns i veckoplanen hoppas över.
- **Ett av varje**, rubrik och undertext "Från superlätt till medel, det du lagat minst nyligen". En rad per insats 1, 2 och 3: tumnagel 58 px (radie 20), insatsikoner med etikett, namn och "Lagad för …". Byt-knappen (cirkel 40 px, rotate-ccw) visar nästa recept på samma nivå, sorterat på längst sedan lagad. Knappen visas bara om nivån har fler än ett recept.
- Två rutor bredvid varandra: **Slumpa** (accent-100, shuffle-ikon) och **Vad kan jag laga?** (salvia-100, kylskåpsikon).

### 2. Slumpa (ark), prototyp 3b
Ett nedre ark (radie 40, 10 px marginal, `--shadow-lg`, inglidning `translateY(40px)→0` på 250 ms ease-out). Filter: insats 1–5 som flerval (tomt betyder alla) och taggar som flerval (receptet behöver matcha minst en). Knappen "Slumpa bland N" ger ett resultatkort som öppnar receptet. Därefter heter knappen "Slumpa igen" och undviker samma recept två gånger i rad. Matchar inget visas "Inget recept matchar. Prova färre val." Öppnas arket från veckoplanens väljare finns också knappen "Välj för {dag}".

### 3. Vad kan jag laga?, prototyp 3c
Fält och plusknapp för det man har hemma. Valda saker visas som salviefärgade pills som tas bort vid tryck. "Vanligt i dina recept" listar förslag sorterade på hur många recept som använder ingrediensen. "Förslag" listar alla recept med ingredienser, sorterade på minst antal saknade och sedan flest ingredienser. Varje kort har en etikett "Du har allt" eller "Har X av Y", en förloppsstapel och raden "Saknas: a, b, c +N".
Matchning: gemener; en sak räknas som "hemma" om namnen innehåller varandra eller om ett ord på minst 4 tecken matchar på de första 5 tecknen. Skafferilistan är delad i hushållet.

### 4. Veckan, prototyp 3d och 3e
Kicker "Vecka 44 · 26 okt – 1 nov", H1 "Veckan" och en sammanfattning ("3 middagar planerade · 1 helgprojekt eller mer"). Sju rader, måndag till söndag: en dagbricka 48 px bred (kort veckodag och datum; idag i `--color-accent` med ljus text; passerade dagar med opacitet 0,55). Planerad dag: kort med namn och insatsikoner samt en x-knapp som tar bort. Tom dag: streckad knapp "+ Välj recept" som öppnar väljararket med alla recept sorterade på längst sedan lagad och en knapp "Slumpa".

### 5. Recept (lista), prototyp 2a
Kicker "N sparade", H1 "Mina recept". Växling mellan kort och lista (segment med två ikoner; listvyn är standard). Sökfält (pill, 48 px, `--color-surface`) som söker i namn, taggar, bok och webbadress. Filterknapp med en salviefärgad bricka som visar antal aktiva filter. Horisontell rad med taggchips ("Alla" + taggar; aktivt chip har mörk fyllning).
Listrad: tumnagel 62 px (radie 20), namn (16 px Caprasimo), källa ("koket.se" eller "Silverskeden s. 284"), taggpills och till höger insatsikoner med etikett.
Filterarket har insats (flerval), källa (Alla, Webb, Kokbok), taggar (flerval, alla måste matcha) och sortering (Senast sparade, Minst insats, Mest insats). Knappen heter "Visa N recept".
Tomt resultat: "Inga recept matchar" och knappen "Rensa filter".

### 6. Receptsida, prototyp 3f och 1a-skärmarna
- Bild 330 px hög med nedre hörn i radie 34. Tillbakaknappen är en cirkel på 44 px uppe till vänster (bakgrund `--color-bg`, `--shadow-md`) och går tillbaka till den skärm man kom från.
- H1 31 px. Portioner (users-ikon).
- Insatskort: "INSATS" och "3/5 · Medel" samt fem ikoner på 24 px. Ikonen är Lucide `flame`; ifyllda i `--color-accent`, tomma i `--color-neutral-300`.
- Källa: för webb en rad med globikon, domän, "Hämtat {datum} · Öppna originalet" och en pil som öppnar länken. För bok en rad med bokikon, boktitel, "Kokbok" och "SIDA 284" till höger.
- **Senast lagad**: salviefärgat kort med t.ex. "För 12 dagar sedan" och knappen "Lagade idag". Knappen sätter `last_cooked_on = idag`, nollställer avbockningar och visar en toast.
- Taggpills.
- Flikar i segmentform: **Ingredienser · Gör så här · Näring**.
  - **Ingredienser:** portionsväljare (− N portioner +, 1–20) som skalar mängderna. Raden har bock-cirkel, mängd och namn; tryck för att bocka av (genomstruken, opacitet 0,5). "X av Y avbockade · Återställ". Bokrecept utan ingredienser visar kortet "Står i boken" med knappen "Skriv in ingredienser".
  - **Gör så här:** samma portionsväljare ("Mängder för"). Numrerade steg (salviefärgade cirklar på 32 px) och under varje steg pills med **mängd och namn på de ingredienser steget använder**, skalade efter portioner. Koppling via `recipe_steps.ingredient_ids`. Saknas kopplingen gissas den: ett ord på minst 4 tecken i ingrediensnamnet vars första 5 tecken finns i stegtexten. Användaren ska kunna rätta kopplingen; den redigeringen finns inte i designen ännu.
  - **Näring (per portion):** stort salviefärgat kort med kcal (46 px Caprasimo) och kJ. Fyra rutor för protein, fett, kolhydrater och fiber med stapel och E% (fiber visar "Rek. 25–35 g/dag"). "Vitaminer och mineraler" som andel av referensintag (NNR) med stapel: vitamin D, B12, C, folat, järn, kalcium, jod, selen. Salt, socker och mättat fett i tre små rutor. "Matchat mot Livsmedelsverket" listar ingrediens → livsmedel med etiketten **Säker** (salvia) eller **Osäker** (accent); tryck för att byta livsmedel. Fotnot om källan.
- **Mina anteckningar**: textfält längst ner, delat mellan er och sparat automatiskt (debounce cirka 600 ms).

### 7. Lägg till (ark), prototyp 2b
Tre val: **Från en länk** (salvia), **Från en kokbokssida** ("Kopiera texten med kameran", accent) och **Bara bok och sida** ("Snabbast, utan ingredienser", konturram).

### 8. Från länk, prototyp 1a-skärmarna
1. "Klistra in en länk", ett url-fält och en urklippsrad som föreslår länken i urklippet. Knapp "Hämta recept". Validering: ser texten inte ut som en webbadress visas felet "Klistra in en webbadress, t.ex. https://www.koket.se/…".
2. Laddning: snurra med "Läser {domän}…" och pulserande skelett.
3. **Granska och spara:** bild, namn (redigerbart), en salviefärgad ruta med det som hittades (ingredienser, steg, portioner), insats 1–5 (obligatoriskt, annars felet "Välj hur mycket insats receptet kräver."), taggar, uppskattat näringsvärde och knappen "Spara recept". Efter sparning öppnas receptsidan med toasten "Receptet är sparat".

**Serverfunktion `/api/import?url=`:** hämtar HTML, letar efter `<script type="application/ld+json">` med `@type: Recipe` (även inuti `@graph`) och returnerar `name`, `image`, `recipeYield`, `recipeIngredient[]` och `recipeInstructions[]` (`HowToStep.text`). Reserv: Open Graph-titel och bild. Ingrediensraderna parsas till mängd, enhet och namn med samma regler som nedan.

### 9. Från kokbokssida, prototyp 2c, 2d och 2e
**Huvudflöde: klistra in från Live Text** (ingen AI, inga nycklar):
1. Instruktion i tre numrerade steg: "Öppna Kamera och rikta den mot receptet." · "Tryck på textikonen nere till höger och välj Kopiera allt." · "Kom tillbaka hit och klistra in."
2. Ett textfält, knappen "Klistra in" (`navigator.clipboard.readText()`, med vanlig inklistring som reserv) och därefter "Klistra in en spalt till", som lägger till text efter den befintliga. Knappen "Sortera texten".
3. Reservlänken "Fota i appen istället (sämre på svår text)" öppnar en kamerasökare (`<input type="file" accept="image/*" capture="environment">`) och kör Tesseract.js med `swe`. Under tiden visas "Läser texten…".

**Tolkningsregler (`parseRaw`):**
- Upp till tre inledande rader utan siffra och kortare än 40 tecken slås ihop till receptnamn.
- Rubriker som tas bort: Ingredienser, Gör så här, Så här gör du, Tillagning, Instruktioner, Du behöver.
- `^\d{1,4}$` tolkas som sidnummer ("Sidnumret hittades nederst på sidan."). `^\d+ portion` tolkas som antal portioner.
- Ingrediens: börjar med en mängd och har en valfri enhet (g, kg, dl, l, ml, cl, msk, tsk, krm, st, burk, paket, kruka), och raden är kortare än 48 tecken.
- Annars är raden ett steg. Inledande "1." eller "1)" tas bort. Ett steg som inte slutar med `. ! ?` slås ihop med nästa rad, om nästa rad inte börjar med ett nytt stegnummer. Det lagar radbrytningar från smala spalter.

**Sortera texten:** namn, bok (med förslag på tidigare böcker) och sida. Räknare "N ingredienser" och "N steg". Varje rad har en etikett; tryck växlar mellan **Ingrediens → Steg → Ignoreras**. Ignorerade rader är genomstrukna. Därefter insats, taggar och knapparna "Fota igen" och "Spara recept". Bok är obligatoriskt.

### 10. Bara bok och sida
Fält för namn, bok (med förslag) och sida (endast siffror, högst 4), insats, taggar och valfria ingredienser med en per rad. Felet "Fyll i receptets namn och vilken bok det står i." visas om något saknas.

### 11. Taggar
Kicker "N st", H1 "Taggar" och hjälptexten "Tryck på färgen för att byta. Tryck på en tagg för att se dess recept." Fält och knappen "Lägg till" (Enter fungerar också); dubbletter ger felet "Taggen ”X” finns redan." Varje rad har en färgcirkel 36 px (tryck byter mellan accent, salvia, sand och lera), namn, "N recept" och en papperskorg. Start-taggar: Fisk, Soppa, Pasta och Vegetarisk.

## Etiketter för "senast lagad"
`null` → "Aldrig lagad" · 0 → "Lagad idag" · 1 → "Lagad igår" · <14 → "Lagad för N dagar sedan" · <60 → "för N veckor sedan" (avrundat) · annars "för N månader sedan".

## Näringsberäkning
Per ingrediens: mängd → gram via en enhetstabell (dl, msk, tsk, st per livsmedel med standardvikter; spara vikterna som data). Värde = gram/100 × livsmedlets värde per 100 g. Summera och dela med antal portioner. E% = (protein×4, fett×9, kolhydrat×4) / kcal. Matchning: fritextsökning mot livsmedelsnamn. Bästa träffen sparas som `lv_food_id`; om den är osäker (låg likhet) markeras `unsure`. Användaren kan byta livsmedel via ett sökark (finns inte ritat ännu).

## Toasts och animationer
- Toast: mörk pill överst, bock i `--color-accent-2-300`, visas i 2,2 s med inglidning 200 ms. Texter: "Receptet är sparat", "Markerad som lagad idag", "Lagt på {dag}", "Veckan är redan full", "Taggen X har lagts till".
- Ark: bakgrund `--color-neutral-900` med 45 % opacitet; tryck utanför stänger.
- Snurra: 0,8 s linear. Skelett: pulserar i opacitet 0,55–1 över 1,2 s.

## Design tokens (designsystemet Organic)
Hela token-filen finns i `prototyp/_ds/.../styles.css`; använd den som källa.
- Färger: bg `#f5ead8`, surface `#ebddc5`, text `#201e1d`, accent `#c67139`, accent-2 (salvia) `#7a8a5e`, divider 16 % text.
  - Accent-ramp 100–900: `#fff2eb #ffe1d0 #ffc6a5 #f6a06b #d67f48 #b2622d #8c491a #643312 #402310`
  - Salvia-ramp: `#f0fae1 #e1eecc #ccdbb2 #aebf92 #8fa073 #728157 #56633f #3d472b #272e1b`
  - Neutral-ramp: `#f9f4ed #eee7db #dcd3c4 #c0b6a5 #a19786 #82796a #645c50 #474238 #2e2b25`
- Taggtoner (bakgrund/text): accent 100/800, salvia 100/800, sand neutral-200/800, lera accent-200/900.
- Typsnitt: rubriker **Caprasimo** 400, brödtext **Figtree** 400/600/700 (Google Fonts). Basstorlek 15 px och radhöjd 1,45–1,55.
- Radier: 8/16/28. Kort 24–34. Ark 40. Knappar, fält och chips 999 (pill).
- Skuggor: sm `0 1px 2px #2e2b25 14%`, md `0 3px 10px 16%`, lg `0 12px 32px 22%`.
- Fokus: `outline: 2px solid var(--color-accent); outline-offset: 2px`.
- Minsta träffyta 44 px.

## Ikoner
Lucide (lucide.dev), streckbredd **2,75**. Använda ikoner finns i `prototyp/icons/`: flame (insats), house, book-marked, calendar-days, tag, plus, search, sliders-horizontal, layout-grid, list, chevron-left, x, check, circle-check, globe, arrow-up-right, book-open, camera, link, users, minus, trash-2, shuffle, refrigerator, rotate-ccw, notebook-pen. Använd `lucide-react` med `strokeWidth={2.75}`.

## Byggordning
1. Projekt, PWA-skal, tokens, flikrad.
2. Supabase: auth, hushåll och inbjudan, RLS.
3. Recept: lista, receptsida, bara bok och sida, taggar. Realtime-synk.
4. Länkimport (serverfunktion och granskning).
5. Klistra in från Live Text med sortering; därefter Tesseract-reserv.
6. Avbockning, senast lagad, anteckningar.
7. Veckan, Idag, Slumpa, Vad kan jag laga?
8. Näring mot Livsmedelsverket.

## Filer
- `prototyp/Receptappen.dc.html`: översikt över alla skärmar (öppna i webbläsare).
- `prototyp/ReceptApp.dc.html`: hela den klickbara appen, med all logik i klassen längst ner (seed-data, tolkning, förslag, matchning).
- `prototyp/icons/`: Lucide-ikonerna.
- `prototyp/_ds/.../styles.css`: design tokens och komponentklasser.
- `prototyp/ios-frame.jsx`, `prototyp/support.js`: används bara för att visa prototypen.
