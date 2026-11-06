import type { ReactNode } from "react";
import { useEffect } from "react";

import type { IconName } from "@/components/ui/icon";
import { AgentsWindowContent } from "@/routes/v2/pages/Tangent/components/AgentsWindowContent";
import { AssetsWindowContent } from "@/routes/v2/pages/Tangent/components/AssetsWindowContent";
import { ProjectWindowContent } from "@/routes/v2/pages/Tangent/components/ProjectWindowContent";
import { ResourcesWindowContent } from "@/routes/v2/pages/Tangent/components/ResourcesWindowContent";
import { RunsWindowContent } from "@/routes/v2/pages/Tangent/components/RunsWindowContent";
import { SecretsWindowContent } from "@/routes/v2/pages/Tangent/components/SecretsWindowContent";
import { SessionsWindowContent } from "@/routes/v2/pages/Tangent/components/SessionsWindowContent";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";
import { useTeamForProjects } from "@/services/teams/useTeamForProjects";

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

const MAX_PROJECT_WINDOW_HEIGHT = 320;

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

const SECRETS_DOCK_WINDOW: ProjectDockWindow = {
  id: "tangent-project-secrets",
  title: "Secrets",
  icon: "KeyRound",
  content: <SecretsWindowContent />,
};

function openProjectDockWindow(
  windows: WindowStoreImpl,
  win: ProjectDockWindow,
) {
  windows.openWindow(win.content, {
    id: win.id,
    title: win.title,
    persisted: true,
    defaultDockState: "left",
    startVisible: true,
    maxDockedHeight: MAX_PROJECT_WINDOW_HEIGHT,
    miniContent: (
      <WindowMiniButton tooltip={win.title} label={win.title} icon={win.icon} />
    ),
  });
}

export function useTangentProjectWindows() {
  const { windows } = useSharedStores();
  const { projectId } = useTangentProject();
  const team = useTeamForProjects([projectId]);
  const hasSecretsWindow =
    team.status !== "none" && team.status !== "resolving";

  useEffect(() => {
    const remembered = rememberedDockWindows(windows);

    PROJECT_DOCK_WINDOWS.forEach((win) => {
      if (windows.getWindowById(win.id)) return;
      openProjectDockWindow(windows, win);
    });

    placeProjectDockWindows(windows, remembered);
  }, [windows]);

  useEffect(() => {
    if (!hasSecretsWindow) {
      windows.closeWindow(SECRETS_DOCK_WINDOW.id);
      return;
    }
    if (windows.getWindowById(SECRETS_DOCK_WINDOW.id)) return;

    const remembered = rememberedDockWindows(windows);
    openProjectDockWindow(windows, SECRETS_DOCK_WINDOW);
    placeProjectDockWindows(windows, remembered);
  }, [windows, hasSecretsWindow]);
}
