import { useEffect } from "react";

import { initPersistence } from "../windows/windowPersistence";

export function useWindowPersistence() {
  useEffect(() => {
    const cleanup = initPersistence();
    return cleanup;
  }, []);
}
