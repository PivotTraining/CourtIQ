import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for use in:
 *   - Server Components
 *   - Route Handlers (app/api/*)
 *   - Middleware (use the middleware helper instead — see middleware.js)
 *
 * Reads and writes auth cookies via next/headers so the session is
 * available server-side without an extra round-trip.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from Server Components where cookies are
            // read-only. The middleware will keep the session fresh.
          }
        },
      },
    }
  );
}
