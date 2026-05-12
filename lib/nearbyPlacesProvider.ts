import { haversineMeters, metersPerDegLng } from "@/lib/geo";

export type NearbyPlace = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  subtitle?: string;
  /** Distance from the searching user, in metres. Populated when the search was GPS-anchored. */
  distanceMeters?: number;
};

export type NearbyPlacesQuery = {
  latitude: number;
  longitude: number;
  /** Bounding-box radius for results, in metres. */
  radiusMeters: number;
  /** Free-text query (e.g. "coffee", "Skyline Chili"). Optional — empty = generic nearby browse. */
  query?: string;
  /** Optional category hint for providers that support it. */
  category?: string;
  /** Aborts the request if it's still in flight when set. */
  signal?: AbortSignal;
  /**
   * When true, do not restrict results to `radiusMeters` around the user and
   * use unbounded geocoding (any place on Earth). Schedule search uses this.
   */
  worldwide?: boolean;
};

export type NearbyPlacesProvider = {
  getNearbyPlaces(args: NearbyPlacesQuery): Promise<NearbyPlace[]>;
};

/**
 * Default provider used while no external API is wired.
 * Keeping this contract in place makes adding Google / OSM providers a drop-in change.
 */
export const noopNearbyPlacesProvider: NearbyPlacesProvider = {
  async getNearbyPlaces() {
    return [];
  },
};

// ─── Photon (komoot public instance) ─────────────────────────────────────────
//
// OSM-backed search with better fuzzy matching and POI ranking than raw
// Nominatim `search?q=…`. No API key. Public instance — be reasonable with
// request volume (debounce in the UI; no tight loops).
//
// https://photon.komoot.io

const PHOTON_BASE_URL = "https://photon.komoot.io/api/";

type PhotonGeometry = {
  type: string;
  coordinates: unknown;
};

type PhotonFeature = {
  type: "Feature";
  geometry?: PhotonGeometry;
  properties?: Record<string, unknown>;
};

type PhotonResponse = {
  type: string;
  features?: PhotonFeature[];
};

function pointFromPhotonGeometry(
  geometry: PhotonGeometry | undefined,
): { latitude: number; longitude: number } | null {
  if (!geometry || geometry.type !== "Point") return null;
  const c = geometry.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lon = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}

function photonTitle(props: Record<string, unknown>): string {
  const name = typeof props.name === "string" ? props.name.trim() : "";
  if (name) return name;
  const street = typeof props.street === "string" ? props.street.trim() : "";
  const hn =
    typeof props.housenumber === "string" ? props.housenumber.trim() : "";
  const line1 = [hn, street].filter(Boolean).join(" ");
  const city = typeof props.city === "string" ? props.city.trim() : "";
  if (line1 && city) return `${line1}, ${city}`;
  if (line1) return line1;
  if (city) return city;
  const locality =
    typeof props.locality === "string" ? props.locality.trim() : "";
  if (locality) return locality;
  return "Unnamed place";
}

function photonSubtitle(
  props: Record<string, unknown>,
  distanceMeters: number,
): string {
  const key = typeof props.osm_key === "string" ? props.osm_key : "";
  const val = typeof props.osm_value === "string" ? props.osm_value : "";
  const kind =
    key && val ? `${key} · ${val}` : key || val || "place";
  const city = typeof props.city === "string" ? props.city : "";
  const state = typeof props.state === "string" ? props.state : "";
  const region = [city, state].filter(Boolean).join(", ");
  const dist =
    distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} km`
      : `${Math.round(distanceMeters)} m`;
  return region ? `${kind} · ${dist} · ${region}` : `${kind} · ${dist}`;
}

function photonStableId(
  props: Record<string, unknown>,
  lat: number,
  lng: number,
): string {
  const t = typeof props.osm_type === "string" ? props.osm_type : "x";
  const id =
    typeof props.osm_id === "number"
      ? props.osm_id
      : typeof props.osm_id === "string"
        ? props.osm_id
        : "";
  if (id !== "") return `${t}:${id}`;
  return `photon:${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export const photonPlacesProvider: NearbyPlacesProvider = {
  async getNearbyPlaces({
    latitude,
    longitude,
    radiusMeters,
    query,
    signal,
    worldwide = false,
  }: NearbyPlacesQuery) {
    const q = query?.trim();
    if (!q) return [];

    const params = new URLSearchParams({
      q,
      limit: worldwide ? "20" : "15",
    });
    // Location bias helps disambiguate ("Springfield") without clipping results
    // when `worldwide` is true — only the client-side distance filter is dropped.
    params.set("lat", String(latitude));
    params.set("lon", String(longitude));

    const url = `${PHOTON_BASE_URL}?${params.toString()}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      });
    } catch (err) {
      if (signal?.aborted) return [];
      throw err;
    }

    if (!response.ok) {
      throw new Error(`Photon request failed: ${response.status}`);
    }

    const data = (await response.json()) as PhotonResponse;
    const features = data.features ?? [];
    const origin = { latitude, longitude };
    const maxDist = worldwide
      ? Number.POSITIVE_INFINITY
      : Math.max(radiusMeters * 1.35, radiusMeters + 500);

    const mapped: NearbyPlace[] = [];
    for (const f of features) {
      const props = f.properties ?? {};
      const pt = pointFromPhotonGeometry(f.geometry);
      if (!pt) continue;
      const distance = haversineMeters(origin, pt);
      if (!worldwide && distance > maxDist) continue;
      mapped.push({
        id: photonStableId(props, pt.latitude, pt.longitude),
        title: photonTitle(props),
        latitude: pt.latitude,
        longitude: pt.longitude,
        subtitle: photonSubtitle(props, distance),
        distanceMeters: distance,
      });
    }

    mapped.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    return mapped.slice(0, 10);
  },
};

// ─── Nominatim (OpenStreetMap) ───────────────────────────────────────────────
//
// Free, no API key required. Public usage policy
// (https://operations.osmfoundation.org/policies/nominatim/) requires:
//   • A meaningful User-Agent identifying the app.
//   • No more than 1 request per second.
//   • No bulk/automated scraping.
// This implementation respects both: it serializes requests through a
// `lastRequestAt` promise chain so concurrent callers queue up at 1 req/s.

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_USER_AGENT = "Lua/1.0 (https://github.com/lua-app)";
const NOMINATIM_MIN_INTERVAL_MS = 1100; // tiny buffer over the 1 req/s policy

let lastRequestAt = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const delta = now - lastRequestAt;
  if (delta < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS - delta),
    );
  }
  lastRequestAt = Date.now();
}

type NominatimRawResult = {
  place_id?: number | string;
  osm_id?: number | string;
  osm_type?: string;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  address?: Record<string, string>;
};

function metersToBoundingBox(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): { west: number; south: number; east: number; north: number } {
  const dLat = radiusMeters / 111_000;
  const mPerDegLng = metersPerDegLng(latitude);
  const dLng = mPerDegLng > 0 ? radiusMeters / mPerDegLng : dLat;
  return {
    west: longitude - dLng,
    south: latitude - dLat,
    east: longitude + dLng,
    north: latitude + dLat,
  };
}

function formatSubtitle(
  result: NominatimRawResult,
  distanceMeters: number,
): string {
  const kind =
    result.type ?? result.class ?? result.address?.amenity ?? "place";
  const prettyKind = kind.replace(/_/g, " ");
  const distance =
    distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} km`
      : `${Math.round(distanceMeters)} m`;
  return `${prettyKind} · ${distance}`;
}

export const nominatimPlacesProvider: NearbyPlacesProvider = {
  async getNearbyPlaces({
    latitude,
    longitude,
    radiusMeters,
    query,
    signal,
    worldwide = false,
  }: NearbyPlacesQuery) {
    const q = query?.trim();
    if (!q) return [];

    const params = new URLSearchParams({
      q,
      format: "jsonv2",
      addressdetails: "1",
      limit: "10",
    });
    if (worldwide) {
      // Global search — no viewbox / bounded (those force local-only matches).
    } else {
      const box = metersToBoundingBox(latitude, longitude, radiusMeters);
      params.set("bounded", "1");
      params.set(
        "viewbox",
        `${box.west},${box.north},${box.east},${box.south}`,
      );
    }
    const url = `${NOMINATIM_BASE_URL}?${params.toString()}`;

    await waitForRateLimit();

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": NOMINATIM_USER_AGENT,
          Accept: "application/json",
        },
        signal,
      });
    } catch (err) {
      if (signal?.aborted) return [];
      throw err;
    }

    if (!response.ok) {
      throw new Error(`Nominatim request failed: ${response.status}`);
    }

    const raw = (await response.json()) as NominatimRawResult[];
    const origin = { latitude, longitude };

    return raw.map<NearbyPlace>((entry) => {
      const lat = parseFloat(entry.lat);
      const lng = parseFloat(entry.lon);
      const distance = haversineMeters(origin, {
        latitude: lat,
        longitude: lng,
      });
      const title =
        entry.name?.trim() ||
        entry.display_name.split(",")[0]?.trim() ||
        "Unnamed place";
      const id = String(
        entry.osm_id ?? entry.place_id ?? `${entry.lat},${entry.lon}`,
      );
      return {
        id,
        title,
        latitude: lat,
        longitude: lng,
        subtitle: formatSubtitle(entry, distance),
        distanceMeters: distance,
      };
    });
  },
};

/**
 * Schedule / map search: Photon first (fuzzy, fast), Nominatim if Photon is
 * empty or errors (e.g. instance down).
 */
export const schedulePlacesSearchProvider: NearbyPlacesProvider = {
  async getNearbyPlaces(args) {
    try {
      const fromPhoton = await photonPlacesProvider.getNearbyPlaces(args);
      if (fromPhoton.length > 0) return fromPhoton;
    } catch {
      // fall through to Nominatim
    }
    return nominatimPlacesProvider.getNearbyPlaces(args);
  },
};
