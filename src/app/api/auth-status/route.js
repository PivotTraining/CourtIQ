import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function publicStatus(status, auth, reason) {
  return NextResponse.json(
    { status, auth, reason, checkedAt: new Date().toISOString() },
    {
      status: status === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return publicStatus("degraded", "unavailable", "missing_configuration");
  }

  let origin;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return publicStatus("degraded", "unavailable", "invalid_configuration");
    }
    origin = parsed.origin;
  } catch {
    return publicStatus("degraded", "unavailable", "invalid_configuration");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${origin}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: key },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return publicStatus("degraded", "unavailable", `upstream_${response.status}`);
    }

    return publicStatus("ok", "reachable", "healthy");
  } catch (error) {
    const reason = error?.name === "AbortError" ? "timeout" : "unreachable";
    return publicStatus("degraded", "unavailable", reason);
  } finally {
    clearTimeout(timer);
  }
}
