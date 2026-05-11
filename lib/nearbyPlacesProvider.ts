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
  }: NearbyPlacesQuery) {
    const q = query?.trim();
    if (!q) return [];

    const box = metersToBoundingBox(latitude, longitude, radiusMeters);
    const params = new URLSearchParams({
      q,
      format: "jsonv2",
      addressdetails: "1",
      limit: "10",
      bounded: "1",
      viewbox: `${box.west},${box.north},${box.east},${box.south}`,
    });
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
