import { useEffect } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function useLinkedWindowCleanup() {
  const { windows: windowStore } = useSharedStores();
  useEffect(() => {
    return () => {
      for (const win of windowStore.getAllWindows()) {
        if (win.linkedEntityId) windowStore.closeWindow(win.id);
      }
    };
  }, [windowStore]);
}
