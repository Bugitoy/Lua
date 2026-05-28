import { useEffect, type ReactNode } from "react";

import { loadProfile } from "@/lib/profileStore";

/** Loads persisted profile from AsyncStorage on app start (non-blocking). */
export function ProfileProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void loadProfile();
  }, []);

  return children;
}
