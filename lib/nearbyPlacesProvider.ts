export type NearbyPlace = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  subtitle?: string;
};

export type NearbyPlacesProvider = {
  getNearbyPlaces(args: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    category?: string;
  }): Promise<NearbyPlace[]>;
};

/**
 * Default provider used by the MVP while external APIs are undecided.
 * Keeping this contract in place makes adding Google/OSM providers a drop-in change.
 */
export const noopNearbyPlacesProvider: NearbyPlacesProvider = {
  async getNearbyPlaces() {
    return [];
  },
};
