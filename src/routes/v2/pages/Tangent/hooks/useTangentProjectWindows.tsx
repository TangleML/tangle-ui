import { useEffect } from "react";

import { ProjectsWindowContent } from "@/routes/v2/pages/Tangent/components/ProjectsWindowContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

export const PROJECTS_WINDOW_ID = "tangent-project-projects";

/**
 * Every project and its sessions dock on the left. The project in view's
 * resources, assets and runs live in a card over the canvas instead
 * ({@link import("../components/ProjectPanelCard").ProjectPanelCard}).
 */
export function useTangentProjectWindows() {
  const { windows } = useSharedStores();

  useEffect(() => {
    if (windows.getWindowById(PROJECTS_WINDOW_ID)) return;
    windows.openWindow(<ProjectsWindowContent />, {
      id: PROJECTS_WINDOW_ID,
      title: "Projects",
      persisted: true,
      defaultDockState: "left",
      startVisible: true,
      fillDockHeight: true,
      miniContent: (
        <WindowMiniButton
          tooltip="Projects"
          label="Projects"
          icon="FolderTree"
        />
      ),
    });
  }, [windows]);
}
