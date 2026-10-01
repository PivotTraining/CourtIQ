import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

Deno.serve(async (request) => {
  const allowedOrigins = new Set([
    "https://app.getcourtiq.com", "https://getcourtiq.com", "https://www.getcourtiq.com",
    "https://court-iq-deploy-git-codex-court-58c0ba-pivot-trainings-projects.vercel.app",
  ]);
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const headers = { ...corsHeaders, ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}) };
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Authentication required" }, { status: 401, headers });
  }
  const token = authorization.slice(7);
  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Confirmation required" }, { status: 400, headers });
  }
  if (body?.confirmation !== "DELETE") {
    return Response.json({ error: "Confirmation required" }, { status: 400, headers });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("delete-account is missing required environment variables");
    return Response.json({ error: "Service unavailable" }, { status: 503, headers });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return Response.json({ error: "Invalid session" }, { status: 401, headers });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Must deploy only after the owner FK migration. No separate data deletes:
  // Auth deletion and player/session/shot/journal cascades are one DB transaction.
  const { error: signOutError } = await admin.auth.admin.signOut(token, "global");
  if (signOutError) {
    console.error("delete-account session revocation failed");
    return Response.json({ error: "Account could not be removed" }, { status: 500, headers });
  }

  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error("delete-account auth removal failed");
    return Response.json({ error: "Account could not be removed" }, { status: 500, headers });
  }

  return Response.json({ deleted: true }, { headers });
});
