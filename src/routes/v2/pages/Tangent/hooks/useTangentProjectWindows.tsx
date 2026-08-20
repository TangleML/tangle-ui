import type { ReactNode } from "react";
import { useEffect } from "react";

import type { IconName } from "@/components/ui/icon";
import { AgentsWindowContent } from "@/routes/v2/pages/Tangent/components/AgentsWindowContent";
import { AssetsWindowContent } from "@/routes/v2/pages/Tangent/components/AssetsWindowContent";
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
    title: "Project resources",
    icon: "Workflow",
    content: <ResourcesWindowContent />,
  },
];

export function useTangentProjectWindows() {
  const { windows } = useSharedStores();

  useEffect(() => {
    for (const win of PROJECT_DOCK_WINDOWS) {
      if (windows.getWindowById(win.id)) continue;
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
    }
  }, [windows]);
}
