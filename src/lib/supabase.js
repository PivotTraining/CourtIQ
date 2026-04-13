import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

// Backwards-compat shim — code that calls getSupabase() continues to work.
// JWT is automatically attached by the Supabase client, so no firebase-uid header needed.
export function getSupabase() {
  return supabase;
}

// No-op — kept so callers don't break during migration.
export function setFirebaseUID() {}
