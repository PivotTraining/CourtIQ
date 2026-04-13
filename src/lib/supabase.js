import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Uses @supabase/ssr so that auth cookies are managed automatically,
 * keeping the session in sync between client and server on Vercel.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Singleton for components that import `supabase` directly.
// Safe to call at module load because createBrowserClient is lazy.
export const supabase = createClient();

// Backwards-compat shims — no callers need to change.
export function getSupabase() {
  return supabase;
}
export function setFirebaseUID() {}
