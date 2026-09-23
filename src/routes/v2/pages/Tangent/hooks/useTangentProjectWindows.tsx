import type { ReactNode } from "react";
import { useEffect } from "react";

import type { IconName } from "@/components/ui/icon";
import { AgentsWindowContent } from "@/routes/v2/pages/Tangent/components/AgentsWindowContent";
import { AssetsWindowContent } from "@/routes/v2/pages/Tangent/components/AssetsWindowContent";
import { ProjectWindowContent } from "@/routes/v2/pages/Tangent/components/ProjectWindowContent";
import { ResourcesWindowContent } from "@/routes/v2/pages/Tangent/components/ResourcesWindowContent";
import { RunsWindowContent } from "@/routes/v2/pages/Tangent/components/RunsWindowContent";
import { SessionsWindowContent } from "@/routes/v2/pages/Tangent/components/SessionsWindowContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

import {
  placeProjectDockWindows,
  PROJECT_DOCK_WINDOW_IDS,
  rememberedDockWindows,
} from "./tangentProjectWindowOrder";

interface ProjectDockWindow {
  id: (typeof PROJECT_DOCK_WINDOW_IDS)[number];
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
    icon: "FileText",
    content: <ResourcesWindowContent />,
  },
  {
    id: "tangent-project-runs",
    title: "Runs",
    icon: "ListChecks",
    content: <RunsWindowContent />,
  },
];

export function useTangentProjectWindows() {
  const { windows } = useSharedStores();

  useEffect(() => {
    const remembered = rememberedDockWindows(windows);

    PROJECT_DOCK_WINDOWS.forEach((win) => {
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
    });

    placeProjectDockWindows(windows, remembered);
  }, [windows]);
}
