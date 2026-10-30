import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = !!(url && key);

export const supabase = createClient(url || 'https://example.invalid', key || 'missing', {
  auth: {
    // PKCE lägger koden i ?code= så att den inte krockar med hash-routern.
    flowType: 'pkce',
    persistSession: true,
    detectSessionInUrl: true,
  },
});
