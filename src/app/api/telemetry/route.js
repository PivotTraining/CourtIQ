const EVENTS = new Set([
  "app_open",
  "screen_view",
  "workout_started",
  "film_opened",
  "film_marker_added",
  "development_profile_shared",
]);

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 2048) return Response.json({ ok: false }, { status: 413 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
  if (!EVENTS.has(body?.event)) return Response.json({ ok: false }, { status: 400 });

  const properties = {};
  if (typeof body?.properties?.screen === "string") properties.screen = body.properties.screen.slice(0, 40);
  if (typeof body?.properties?.source === "string") properties.source = body.properties.source.slice(0, 40);

  console.info("COURTIQ_EVENT", JSON.stringify({
    event: body.event,
    properties,
    at: new Date().toISOString(),
  }));
  return Response.json({ ok: true });
}
