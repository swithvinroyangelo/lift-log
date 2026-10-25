// The one place the Supabase client is made. Only the URL and the public (publishable/anon) key are used here.
// They are safe to ship to the browser; what protects the data is row level security in the database.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when the app is wired to Supabase. When false it runs on browser storage only. */
export const REMOTE = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
let userId: string | null = null;

export function getClient(): SupabaseClient {
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return client;
}
/** Tests inject a client here. */
export function setClientForTests(c: SupabaseClient | null, uid: string | null): void { client = c; userId = uid; }

export function currentUserId(): string | null { return userId; }
export function setCurrentUserId(id: string | null): void { userId = id; }
