import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedAnon: SupabaseClient | null = null;
let cachedAdmin: SupabaseClient | null = null;

export function supabaseAnon(): SupabaseClient {
  if (cachedAnon) return cachedAnon;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase public env vars");
  cachedAnon = createClient(url, key, { auth: { persistSession: false } });
  return cachedAnon;
}

export function supabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  cachedAdmin = createClient(url, key, { auth: { persistSession: false } });
  return cachedAdmin;
}
