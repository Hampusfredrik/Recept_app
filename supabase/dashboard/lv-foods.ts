// GENERERAD FIL – ändra i supabase/functions/lv-foods/ och kör npm run functions:standalone.
// Klistra in hela filen i Supabase Dashboard → Edge Functions → Deploy a new function → Via Editor.

import { createClient } from 'npm:@supabase/supabase-js@2';

// ── från _shared/cors.ts ──
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ── funktionen ──
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

function mapNutrients(rows: Json[]) {
  const out: Record<string, number> = {};
  const byCode = new Map<string, Json[]>();
  for (const r of rows) {
    const code = String(pick(r, 'euroFIRkod', 'eurofirkod') ?? '').toUpperCase();
    if (!code) continue;
    byCode.set(code, [...(byCode.get(code) ?? []), r]);
  }
  const num = (r: Json) => {
    const v = pick(r, 'varde', 'värde', 'value');
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  for (const [key, codes] of Object.entries(CODES)) {
    for (const c of codes) {
      let cand = byCode.get(c);
      if (!cand?.length) continue;
      if (key === 'kcal') cand = cand.filter((r) => /kcal/i.test(String(pick(r, 'enhet', 'unit') ?? '')));
      const v = cand.length ? num(cand[0]) : null;
      if (v != null) { out[key] = v; break; }
    }
  }
  return out;
}

async function nutrients(ids: number[]) {
  const clean = [...new Set(ids.map(Number).filter(Number.isFinite))].slice(0, 60);
  if (!clean.length) return { foods: [] };
  const { data: have, error } = await admin.from('lv_foods').select('id,name,per_100g').in('id', clean);
  if (error) throw error;
  const missing = clean.filter((id) => !have?.find((h) => h.id === id && h.per_100g));
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
