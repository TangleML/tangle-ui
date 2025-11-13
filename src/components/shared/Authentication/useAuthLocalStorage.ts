import { useMemo } from "react";

import { getStorage } from "@/utils/typedStorage";

import type { JwtAuthStorage, JWTPayload } from "./types";

const storage = getStorage<keyof JwtAuthStorage, JwtAuthStorage>();

export function useAuthLocalStorage() {
  return useMemo(
    () => ({
      getToken: () => storage.getItem("jwtToken")?.original_token,

      getJWT: () => storage.getItem("jwtToken"),
      setJWT: (jwtPayload: JWTPayload) =>
        storage.setItem("jwtToken", jwtPayload),

      clear: () => {
        storage.setItem("jwtToken", undefined);
      },

      /**
       * Subscribe to changes in the local storage
       * @param listener - callback from useSyncExternalStore
       * @returns A function to unsubscribe from the storage changes
       */
      subscribe: (listener: () => void) => {
        function handleStorageChange(event: StorageEvent) {
          if (event.key === "jwtToken") {
            listener();
          }
        }
        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
      },
    }),
    [],
  );
}
