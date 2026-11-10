import { useEffect } from "react";

import { ProjectCardContent } from "@/routes/v2/pages/Tangent/components/ProjectCardContent";
import { ProjectsWindowContent } from "@/routes/v2/pages/Tangent/components/ProjectsWindowContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

export const PROJECTS_WINDOW_ID = "tangent-project-projects";
export const PROJECT_CARD_WINDOW_ID = "tangent-project-card";

// Enough for New chat, the search, and a handful of projects and sessions.
const PROJECTS_MIN_HEIGHT = 320;

/**
 * Every project and its sessions start docked on the left, and the project in
 * view's reports, runs, pipelines and documents in the popover on the right.
 * Either can be dragged to the other side or out to float. The card can't be
 * hidden or closed, since this page has nowhere to bring it back from.
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
        minDockedHeight: PROJECTS_MIN_HEIGHT,
        miniContent: (
          <WindowMiniButton
            tooltip="Projects"
            label="Projects"
            icon="FolderTree"
          />
        ),
      });
    }
    if (!windows.getWindowById(PROJECT_CARD_WINDOW_ID)) {
      windows.openWindow(<ProjectCardContent />, {
        id: PROJECT_CARD_WINDOW_ID,
        title: "Assets",
        persisted: true,
        defaultDockState: "right",
        startVisible: true,
        size: { width: 360, height: 600 },
        disabledActions: ["close", "hide"],
        miniContent: (
          <WindowMiniButton tooltip="Assets" label="Assets" icon="LayoutList" />
        ),
      });
    }
  }, [windows]);
}
