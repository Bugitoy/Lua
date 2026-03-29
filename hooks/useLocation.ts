import * as Location from "expo-location";
import { useEffect, useState } from "react";

export type LocationCoords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** metres per second — null if device didn't report it */
  speed: number | null;
  /** degrees clockwise from true north — null if device didn't report it */
  heading: number | null;
};

type UseLocationResult = {
  location: LocationCoords | null;
  errorMsg: string | null;
};

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission denied");
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (loc) => {
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
            speed: loc.coords.speed ?? null,
            heading: loc.coords.heading ?? null,
          });
        }
      );
    })();

    return () => {
      subscription?.remove();
    };
  }, []);

  return { location, errorMsg };
}
