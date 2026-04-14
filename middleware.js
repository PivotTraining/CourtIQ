import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Supabase auth middleware.
 *
 * Runs on every request that isn't a static asset.
 * Its only job: refresh the auth session so the cookie never expires
 * mid-session on Vercel Edge. Route protection lives in the app itself.
 */
export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on both the outgoing request and response so the
          // refreshed session is visible to downstream Server Components.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT add logic between createServerClient and getUser().
  // A session refresh may happen here; any early return would lose the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /dashboard and all sub-routes — redirect unauthenticated users to /.
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static  (Next.js static files)
     * - _next/image   (Next.js image optimization)
     * - favicon.ico, manifest.json, icons (public assets)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
