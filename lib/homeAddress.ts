import type { NearbyPlace } from "@/lib/nearbyPlacesProvider";
import type { HomeAddress } from "@/lib/profileStore";

/** Id of the "Home" place, so goals set there can be told apart. */
export const HOME_PLACE_ID = "home";

/** A picked place as a home address: its name plus the area under it, when there is one. */
export function homeFromPlace(place: NearbyPlace): HomeAddress {
  const address =
    place.subtitle && !place.title.includes(place.subtitle)
      ? `${place.title}, ${place.subtitle}`
      : place.title;
  return {
    address,
    latitude: place.latitude,
    longitude: place.longitude,
    placeId: place.id,
  };
}

/** The saved home as a place a goal can be set at, named `label` ("Home" in the app's language). */
export function homeAsPlace(home: HomeAddress, label: string): NearbyPlace {
  return {
    id: HOME_PLACE_ID,
    title: label,
    subtitle: home.address,
    latitude: home.latitude,
    longitude: home.longitude,
  };
}
