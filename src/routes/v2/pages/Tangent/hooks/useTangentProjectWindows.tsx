import { useEffect } from "react";

import { AgentsWindowContent } from "@/routes/v2/pages/Tangent/components/AgentsWindowContent";
import { ProjectsWindowContent } from "@/routes/v2/pages/Tangent/components/ProjectsWindowContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

export const PROJECTS_WINDOW_ID = "tangent-project-projects";
export const AGENTS_WINDOW_ID = "tangent-project-agents";

const MAX_AGENTS_WINDOW_HEIGHT = 320;

/**
 * Every project and its sessions dock on the left, above the session's agents.
 * The project in view's resources, assets and runs live in a card over the
 * canvas instead ({@link import("../components/ProjectPanelCard").ProjectPanelCard}).
 */
export function useTangentProjectWindows() {
  const { windows } = useSharedStores();

  useEffect(() => {
    if (!windows.getWindowById(PROJECTS_WINDOW_ID)) {
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
    }

    if (!windows.getWindowById(AGENTS_WINDOW_ID)) {
      windows.openWindow(<AgentsWindowContent />, {
        id: AGENTS_WINDOW_ID,
        title: "Agents",
        persisted: true,
        defaultDockState: "left",
        startVisible: true,
        maxDockedHeight: MAX_AGENTS_WINDOW_HEIGHT,
        miniContent: (
          <WindowMiniButton tooltip="Agents" label="Agents" icon="Bot" />
        ),
      });
    }
  }, [windows]);
}
