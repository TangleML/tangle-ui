import type { ReactNode } from "react";
import { useEffect } from "react";

import type { IconName } from "@/components/ui/icon";
import { AgentsWindowContent } from "@/routes/v2/pages/Tangent/components/AgentsWindowContent";
import { AssetsWindowContent } from "@/routes/v2/pages/Tangent/components/AssetsWindowContent";
import { ProjectWindowContent } from "@/routes/v2/pages/Tangent/components/ProjectWindowContent";
import { ResourcesWindowContent } from "@/routes/v2/pages/Tangent/components/ResourcesWindowContent";
import { SessionsWindowContent } from "@/routes/v2/pages/Tangent/components/SessionsWindowContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

interface ProjectDockWindow {
  id: string;
  title: string;
  icon: IconName;
  content: ReactNode;
}

const PROJECT_DOCK_WINDOWS: ProjectDockWindow[] = [
  {
    id: "tangent-project-details",
    title: "Project",
    icon: "Folder",
    content: <ProjectWindowContent />,
  },
  {
    id: "tangent-project-sessions",
    title: "Sessions",
    icon: "MessagesSquare",
    content: <SessionsWindowContent />,
  },
  {
    id: "tangent-project-agents",
    title: "Agents",
    icon: "Bot",
    content: <AgentsWindowContent />,
  },
  {
    id: "tangent-project-assets",
    title: "Assets",
    icon: "Files",
    content: <AssetsWindowContent />,
  },
  {
    id: "tangent-project-resources",
    title: "Resources",
    icon: "Folder",
    content: <ResourcesWindowContent />,
  },
];

export function useTangentProjectWindows() {
  const { windows } = useSharedStores();

  useEffect(() => {
    PROJECT_DOCK_WINDOWS.forEach((win, index) => {
      if (windows.getWindowById(win.id)) return;
      windows.openWindow(win.content, {
        id: win.id,
        title: win.title,
        persisted: true,
        defaultDockState: "left",
        startVisible: true,
        miniContent: (
          <WindowMiniButton
            tooltip={win.title}
            label={win.title}
            icon={win.icon}
          />
        ),
      });
      // Opening a window appends it to the dock, which would file a window
      // added here later underneath the ones a saved layout already knows
      // about. Docking it again by index puts it where this list says.
      windows.dockWindow(win.id, "left", index);
    });
  }, [windows]);
}
