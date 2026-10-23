const NCES_LAYER = "https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_ADMINDATA_PUBLICSCH_2425/MapServer/1/query";
const PAGE_SIZE = 2000;

function queryUrl(offset) {
  const params = new URLSearchParams({
    where: "LSTATE LIKE 'GA%' AND STATUS='1' AND VIRTUAL='Not Virtual' AND SCHOOL_TYPE_TEXT='Regular School'",
    outFields: "NCESSCH,SCH_NAME,LCITY,LSTATE,GSLO,GSHI,SCHOOL_LEVEL,G06,G07,G08,G09,G10,G11,G12",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
  });
  return `${NCES_LAYER}?${params.toString()}`;
}

function servesBasketballGrades(attributes = {}) {
  return ["G06", "G07", "G08", "G09", "G10", "G11", "G12"].some((key) =>
    attributes[key] !== null && attributes[key] !== undefined && Number(attributes[key]) >= 0);
}

export async function GET() {
  try {
    const features = [];
    for (let offset = 0; offset < 6000; offset += PAGE_SIZE) {
      const response = await fetch(queryUrl(offset), { next: { revalidate: 86400 } });
      if (!response.ok) throw new Error(`NCES request failed: ${response.status}`);
      const payload = await response.json();
      if (payload?.error) throw new Error(payload.error.message || "NCES query failed");
      const page = Array.isArray(payload?.features) ? payload.features : [];
      features.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    const campuses = features
      .filter((feature) => servesBasketballGrades(feature?.attributes) && feature?.geometry)
      .map((feature) => ({
        id: String(feature.attributes.NCESSCH),
        name: feature.attributes.SCH_NAME,
        city: feature.attributes.LCITY,
        lat: Number(feature.geometry.y),
        lon: Number(feature.geometry.x),
      }))
      .filter((campus) => campus.id && campus.name && Number.isFinite(campus.lat) && Number.isFinite(campus.lon))
      .sort((a, b) => a.name.localeCompare(b.name) || a.city.localeCompare(b.city));

    return Response.json({
      source: "NCES EDGE Public School Administrative Data 2024-25",
      note: "Campus coordinates are public-school location points and are not verified gym-building entrances.",
      defaultRadiusMeters: 300,
      count: campuses.length,
      campuses,
    }, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("[gym-campuses]", error);
    return Response.json({ error: "Georgia school-campus data is temporarily unavailable." }, { status: 502 });
  }
}
