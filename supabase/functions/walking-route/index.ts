// Walking route between two points, from the Google Routes API.
//
// POST { origin: { latitude, longitude }, destination: { latitude, longitude } }
// → 200 { distanceMeters, durationSeconds, path: [{ latitude, longitude }, …] }
// → 400 bad input or a trip too long to walk, 404 no walking route, 502 Google failed.
//
// The Google key lives in the GOOGLE_ROUTES_API_KEY secret and never reaches the app.

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
/** Longer than this as the crow flies isn't a walk; refusing it also caps what misuse can cost. */
const MAX_TRIP_METERS = 50_000;

type Point = { latitude: number; longitude: number };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function asPoint(raw: unknown): Point | null {
  if (!raw || typeof raw !== "object") return null;
  const { latitude, longitude } = raw as Record<string, unknown>;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function haversineMeters(a: Point, b: Point): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Google's encoded polyline format → points. */
function decodePolyline(encoded: string): Point[] {
  const points: Point[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

const toLatLng = (p: Point) => ({ location: { latLng: { latitude: p.latitude, longitude: p.longitude } } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const origin = asPoint(body.origin);
  const destination = asPoint(body.destination);
  if (!origin || !destination) return json({ error: "bad_points" }, 400);
  if (haversineMeters(origin, destination) > MAX_TRIP_METERS) return json({ error: "too_far" }, 400);

  const key = Deno.env.get("GOOGLE_ROUTES_API_KEY");
  if (!key) return json({ error: "not_configured" }, 500);

  let res: Response;
  try {
    res = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: toLatLng(origin),
        destination: toLatLng(destination),
        travelMode: "WALK",
      }),
    });
  } catch {
    return json({ error: "google_unreachable" }, 502);
  }
  if (!res.ok) {
    // Log Google's reason for the function logs; the app only needs to know it failed.
    console.error("routes api", res.status, await res.text().catch(() => ""));
    return json({ error: "google_error", status: res.status }, 502);
  }

  const data = (await res.json()) as {
    routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[];
  };
  const route = data.routes?.[0];
  const encoded = route?.polyline?.encodedPolyline;
  if (!route || !encoded) return json({ error: "no_route" }, 404);

  return json({
    distanceMeters: route.distanceMeters ?? 0,
    // Google sends durations like "754s".
    durationSeconds: Number.parseInt(route.duration ?? "0", 10) || 0,
    path: decodePolyline(encoded),
  });
});
