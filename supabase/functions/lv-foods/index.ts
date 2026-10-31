// Supabase Edge Function: cache mot Livsmedelsverkets livsmedelsdatabas.
//
//   POST { "action": "sync" }               → laddar ner livsmedelslistan (nummer + namn) till lv_foods
//   POST { "action": "nutrients", ids: [] } → hämtar näringsvärden per 100 g för livsmedlen och cachar dem
//
// API:t saknar fritextsökning, så listan cachas och matchningen görs i appen.
// Endpoints: /api/v1/livsmedel och /api/v1/livsmedel/{nummer}/naringsvarden
// (fälten namn, euroFIRkod och varde enligt Livsmedelsverkets dokumentation).
// OBS: Övriga fältnamn och svarets struktur kunde inte provköras när koden
// skrevs. Läsningen är därför tolerant mot varianter. Verifiera mot
// https://dataportal.livsmedelsverket.se/livsmedel/swagger/index.html

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const API = 'https://dataportal.livsmedelsverket.se/livsmedel/api/v1';
const STALE_DAYS = 30;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type Json = Record<string, unknown>;
const pick = (o: Json, ...keys: string[]) => {
  for (const k of keys) if (o[k] != null) return o[k];
  const lower = Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) if (lower[k.toLowerCase()] != null) return lower[k.toLowerCase()];
  return undefined;
};

function arrayIn(data: unknown): Json[] {
  if (Array.isArray(data)) return data as Json[];
  if (data && typeof data === 'object') {
    for (const v of Object.values(data as Json)) if (Array.isArray(v)) return v as Json[];
  }
  return [];
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Livsmedelsverket svarade ${res.status} för ${url}`);
  return res.json();
}

async function sync(force: boolean) {
  const { data: newest } = await admin.from('lv_foods').select('fetched_at').order('fetched_at', { ascending: false }).limit(1);
  const last = newest?.[0]?.fetched_at ? new Date(newest[0].fetched_at).getTime() : 0;
  if (!force && Date.now() - last < STALE_DAYS * 864e5) return { synced: 0, cached: true };

  const limit = 500;
  let offset = 0;
  let total = 0;
  const now = new Date().toISOString();
  for (let guard = 0; guard < 40; guard++) {
    const page = arrayIn(await getJson(`${API}/livsmedel?offset=${offset}&limit=${limit}&sprak=1`));
    if (!page.length) break;
    const rows = page
      .map((f) => ({ id: Number(pick(f, 'nummer', 'id')), name: String(pick(f, 'namn', 'name') ?? '').trim(), fetched_at: now }))
      .filter((r) => Number.isFinite(r.id) && r.name);
    if (rows.length) {
      const { error } = await admin.from('lv_foods').upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
      if (error) throw error;
    }
    total += rows.length;
    if (page.length < limit) break;
    offset += limit;
  }
  return { synced: total, cached: false };
}

// EuroFIR-komponentkoder → appens nycklar. Flera koder prövas i tur och ordning.
const CODES: Record<string, string[]> = {
  kcal: ['ENERC'], // väljs med enhet kcal nedan
  protein: ['PROT'],
  fat: ['FAT'],
  carbs: ['CHOAVL', 'CHO'],
  fiber: ['FIBT', 'FIB'],
  sugar: ['SUGAR'],
  satfat: ['FASAT'],
  salt: ['NACL'],
  vitd: ['VITD'],
  b12: ['VITB12'],
  vitc: ['VITC'],
  folate: ['FOL', 'FOLDFE'],
  iron: ['FE'],
  calcium: ['CA'],
  iodine: ['ID'],
  selenium: ['SE'],
};

// Reserv om koden saknas: matcha på näringsämnets namn (svenska eller engelska).
// Mönstren är avsiktligt breda eftersom de exakta namnen inte har kunnat provköras.
const NAMES: Record<string, RegExp> = {
  protein: /^protein/i,
  fat: /^(fett|fat)\b(?!.*syr)/i,
  carbs: /^(kolhydrat|carbohydrate)/i,
  fiber: /^(fiber|fibrer|fibre)/i,
  sugar: /^(socker|sugar)/i,
  satfat: /(mättade|saturated)/i,
  salt: /^salt/i,
  vitd: /^vitamin d\b/i,
  b12: /^vitamin b12/i,
  vitc: /^vitamin c\b/i,
  folate: /^(folat|folate)/i,
  iron: /^(järn|iron)/i,
  calcium: /^(kalcium|calcium)/i,
  iodine: /^(jod|iodine)/i,
  selenium: /^(selen|selenium)/i,
};

function mapNutrients(rows: Json[]) {
  const out: Record<string, number> = {};
  const codesOf = (r: Json) => [pick(r, 'forkortning', 'förkortning'), pick(r, 'euroFIRkod', 'eurofirkod')]
    .filter((x) => x != null).map((x) => String(x).toUpperCase().trim());
  const unitOf = (r: Json) => String(pick(r, 'enhet', 'unit') ?? '');
  const nameOf = (r: Json) => String(pick(r, 'namn', 'name') ?? '').trim();
  const num = (r: Json) => {
    const v = pick(r, 'varde', 'värde', 'value');
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  // Energi: ENERC finns ofta både i kcal och kJ.
  const energy = rows.filter((r) => codesOf(r).includes('ENERC') || /^energi|^energy/i.test(nameOf(r)));
  const kcalRow = energy.find((r) => /kcal/i.test(unitOf(r)) || /kcal/i.test(nameOf(r)));
  const kjRow = energy.find((r) => /kj/i.test(unitOf(r)) || /\bkj\b/i.test(nameOf(r)));
  if (kcalRow && num(kcalRow) != null) out.kcal = num(kcalRow)!;
  else if (kjRow && num(kjRow) != null) out.kcal = num(kjRow)! / 4.184;

  for (const [key, codes] of Object.entries(CODES)) {
    if (key === 'kcal') continue;
    let hit = codes.map((c) => rows.find((r) => codesOf(r).includes(c))).find((r) => r && num(r) != null);
    if (!hit && NAMES[key]) hit = rows.find((r) => NAMES[key].test(nameOf(r)) && num(r) != null);
    if (hit) out[key] = num(hit)!;
  }
  return out;
}

async function nutrients(ids: number[]) {
  const clean = [...new Set(ids.map(Number).filter(Number.isFinite))].slice(0, 60);
  if (!clean.length) return { foods: [] };
  const { data: have, error } = await admin.from('lv_foods').select('id,name,per_100g').in('id', clean);
  if (error) throw error;
  // Värden som cachats med en äldre tolkning tolkas om från de sparade råraderna.
  for (const h of have ?? []) {
    const p = h.per_100g as Json | null;
    if (p && p.kcal == null && Array.isArray(p.raw) && p.raw.length) {
      const per_100g = { ...mapNutrients(p.raw as Json[]), raw: p.raw };
      h.per_100g = per_100g;
      await admin.from('lv_foods').update({ per_100g }).eq('id', h.id);
    }
  }
  const missing = clean.filter((id) => {
    const p = have?.find((h) => h.id === id)?.per_100g as Json | null | undefined;
    return !p || (p.kcal == null && !(Array.isArray(p.raw) && p.raw.length));
  });
  const fetched = await Promise.all(missing.map(async (id) => {
    try {
      const rows = arrayIn(await getJson(`${API}/livsmedel/${id}/naringsvarden?sprak=1`));
      return { id, per_100g: { ...mapNutrients(rows), raw: rows } };
    } catch (e) {
      console.error(e);
      return null;
    }
  }));
  const now = new Date().toISOString();
  for (const f of fetched) {
    if (!f) continue;
    const { error: upErr } = await admin.from('lv_foods').update({ per_100g: f.per_100g, fetched_at: now }).eq('id', f.id);
    if (upErr) console.error(upErr);
  }
  const { data: all } = await admin.from('lv_foods').select('id,name,per_100g').in('id', clean);
  // Skicka inte tillbaka råraderna till klienten.
  return { foods: (all ?? []).map((f) => ({ id: f.id, name: f.name, per_100g: f.per_100g ? { ...f.per_100g, raw: undefined } : null })) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = (await req.json().catch(() => ({}))) as Json;
    if (body.action === 'sync') return json(await sync(body.force === true));
    if (body.action === 'nutrients') return json(await nutrients((body.ids as number[]) ?? []));
    return json({ error: 'Okänd action' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
