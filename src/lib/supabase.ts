import "server-only";
import { createClient } from "@supabase/supabase-js";

// Accepts both our own names and the ones the Vercel ↔ Supabase integration sets
export const supabaseUrl = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseSecret = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server-only client. The secret key bypasses row level security, so it must never reach the browser.
export function db() {
  const url = supabaseUrl();
  const key = supabaseSecret();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}
