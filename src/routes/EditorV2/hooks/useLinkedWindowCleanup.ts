import { useEffect } from "react";

import { closeWindow, getAllWindows } from "../windows/windows.actions";

export function useLinkedWindowCleanup() {
  useEffect(() => {
    return () => {
      const windows = getAllWindows();
      for (const win of windows) {
        if (win.linkedEntityId) closeWindow(win.id);
      }
    };
  }, []);
}
