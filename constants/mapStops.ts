/**
 * Single source of truth for map markers (labels + normalized positions on the campus bitmap).
 * Used by `MapStops` and by schedule location picker labels.
 */
export const MAP_STOPS = [
  { id: "a", x: 0.86, y: 0.05, label: "Marian Spencer Hall" },
  { id: "b", x: 0.58, y: 0.45, label: "Campus Recreation Center" },
  { id: "c", x: 0.3, y: 0.57, label: "Tangeman University Center" },
  { id: "d", x: 0.37, y: 0.8, label: "MarketPointe Dining" },
  { id: "e", x: 0.65, y: 0.15, label: "Sigma Sigma Commons Edge" },
  { id: "f", x: 0.68, y: 0.45, label: "Fifth Third Arena" },
  { id: "g", x: 0.45, y: 0.46, label: "Nippert Stadium" },
  { id: "h", x: 0.28, y: 0.15, label: "Zimmer Hall" },
  { id: "i", x: 0.795, y: 0.4, label: "Dabney Hall" },
  { id: "j", x: 0.48, y: 0.3, label: "Center Court Dining Hall" },
] as const;

export const MAP_STOP_LOCATION_LABELS: readonly string[] = MAP_STOPS.map(
  (s) => s.label,
);

export type MapStopEntry = (typeof MAP_STOPS)[number];
