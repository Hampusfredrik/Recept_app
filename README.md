# Receptappen

En receptapp för två som delar samma samling i realtid. Byggd enligt `design_handoff_receptappen/README.md`.

- **Frontend:** React + Vite + TypeScript, PWA, hostas på **GitHub Pages**
- **Backend:** Supabase (Postgres, Auth med e-postlänk/kod, Realtime, Storage)
- **Länkimport:** Supabase Edge Function `import-recipe`
- **Näring:** Supabase Edge Function `lv-foods`, som cachar Livsmedelsverkets livsmedelsdatabas
- **OCR-reserv:** Tesseract.js (`swe`), körs i webbläsaren

## Struktur

```
src/                       appen (skärmar, ark, komponenter, logik)
supabase/migrations/       tabeller, RLS, realtime, storage
supabase/functions/
  import-recipe/           hämtar schema.org/Recipe (JSON-LD, även i @graph), reserv Open Graph
  lv-foods/                synkar livsmedelslistan och näringsvärden från Livsmedelsverket
  _shared/parse.ts         tolkningsregler som delas av appen och funktionen
.github/workflows/deploy.yml  bygger och publicerar till GitHub Pages
tests/                     tester för tolkningsreglerna (npm test)
```

## Kom igång

### 1. Supabase

1. Skapa ett projekt på supabase.com (gratisnivån räcker).
2. Kör migreringen och publicera funktionerna med Supabase CLI:
   ```bash
   supabase link --project-ref <ditt-projekt-ref>
   ```
   ```bash
   supabase db push
   ```
   ```bash
   supabase functions deploy import-recipe
   ```
   ```bash
   supabase functions deploy lv-foods
   ```
3. **Authentication → URL Configuration:** lägg till
   `https://<ditt-github-namn>.github.io/Recept_app/` under *Redirect URLs* och som *Site URL*.
4. **Authentication → Email Templates → Magic Link:** lägg till koden i mejlet, t.ex.
   `<p>Eller skriv in koden: {{ .Token }}</p>`.
   En PWA på iPhones hemskärm har egen lagring, skild från Safari. Därför loggar man in i hemskärmsappen med koden, inte med länken.

### 2. GitHub Pages

1. **Settings → Pages → Source:** välj *GitHub Actions*.
2. **Settings → Secrets and variables → Actions → Variables:** lägg till
   - `VITE_SUPABASE_URL`: projektets URL
   - `VITE_SUPABASE_ANON_KEY`: projektets anon/publishable-nyckel (den är publik; RLS skyddar datan)
3. Pusha till `main`. Workflowen kör testerna, bygger med `VITE_BASE=/Recept_app/` och publicerar.

### 3. Lokalt

```bash
cp .env.example .env.local
```
```bash
npm install
```
```bash
npm run dev
```

## Delning mellan två personer

Den första som loggar in skapar ett kök. Under personikonen på *Idag* finns inbjudningskoden och en delningslänk (`…/#/join/KOD`). Den andra personen öppnar länken, loggar in och går med automatiskt. RLS ger bara medlemmar i ett kök åtkomst till kökets rader. Ändringar i recept, vecka, avbockningar, skafferi och anteckningar syns direkt hos den andra via Realtime.

## Val och avvikelser

- **Hash-routing** (`#/recept/…`) så att direktlänkar fungerar på GitHub Pages utan serverkonfiguration. Inloggningen använder PKCE (`?code=`), så den krockar inte med hashen.
- **Inbjudan, inloggning, "Byt livsmedel" och "Skriv in ingredienser"** är inte ritade i designen. De följer samma formspråk som arken.
- **Bilder:** recept från webben använder sidans bild. Övriga får den randiga platshållaren i receptets ton. En storage-bucket (`recipe-images`) med RLS finns förberedd för egna bilder, men ingen uppladdning är byggd än.
- **Kopplingen steg ↔ ingredienser** gissas enligt regeln i handoffen när `ingredient_ids` saknas. Det finns ännu inget gränssnitt för att rätta den.

## Näringsberäkningen: vad som är verifierat

- Endpoints `/api/v1/livsmedel` och `/api/v1/livsmedel/{nummer}/naringsvarden` med fälten `namn`, `euroFIRkod` och `varde` kommer från Livsmedelsverkets dokumentation. API:t saknar fritextsökning, så listan cachas i `lv_foods` och matchningen görs i appen.
- **Inte provkört:** Livsmedelsverkets server gick inte att nå från byggmiljön. Svarets struktur och resten av fältnamnen läses därför tolerant, och EuroFIR-koderna mappas i `supabase/functions/lv-foods/index.ts`. Kontrollera dem mot [Swagger-dokumentationen](https://dataportal.livsmedelsverket.se/livsmedel/swagger/index.html) när funktionen körs första gången.
- **Enheter:** msk = 15 ml, tsk = 5 ml och krm = 1 ml. Volym räknas om med 1 g/ml om livsmedlet saknar egen vikt i tabellen `unit_weights`. Det står i fotnoten. Styckvikter (t.ex. "1 gul lök") finns inte förifyllda. Sådana ingredienser räknas inte med förrän en vikt anges, antingen i `unit_weights` eller per ingrediens i arket "Byt livsmedel".
- **NNR-referensvärden** (`src/data/nnr.ts`): vitamin D, C, kalcium, jod och selen stämmer med NNR 2023 för kvinnor 25–50 år. **B12, folat och järn är inte verifierade.**
