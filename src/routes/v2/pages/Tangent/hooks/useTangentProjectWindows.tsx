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
 * Every project and its sessions start docked on the left, with the project in
 * view's reports, runs, pipelines and documents under them. Either can be
 * dragged to the popover on the right or out to float. Neither can be hidden
 * or closed, since this page has nowhere to bring them back from.
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
        disabledActions: ["close", "hide"],
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
        defaultDockState: "left",
        startVisible: true,
        size: { width: 360, height: 600 },
        disabledActions: ["close", "hide"],
        miniContent: (
          <WindowMiniButton tooltip="Assets" label="Assets" icon="LayoutList" />
        ),
      });
    }
    // A layout saved while Projects could still be hidden keeps it hidden.
    for (const id of [PROJECTS_WINDOW_ID, PROJECT_CARD_WINDOW_ID]) {
      const model = windows.getWindowById(id);
      if (model?.state === "hidden") model.restore();
    }
  }, [windows]);
}
