import "@/routes/v2/pages/Tangent/workarea/registerKinds";

import { TangentProvider } from "@tangent/embed-react";
import { Link, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTrackRecentlyViewedProject } from "@/hooks/useTrackRecentlyViewedProject";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { tangentAnchorProtocols } from "@/routes/v2/pages/Tangent/components/tangentAnchorProtocols";
import { getTangentSocketConfig } from "@/routes/v2/pages/Tangent/services/socketConfig";
import { SharedStoreProvider } from "@/routes/v2/shared/store/SharedStoreContext";
import { useProject } from "@/services/projects/useProjects";

import { ProjectHeader } from "./components/ProjectHeader";
import { TangentProjectWorkspace } from "./components/TangentProjectWorkspace";
import { TangentUnreachable } from "./components/TangentUnreachable";
import { TangentProjectProvider } from "./context/TangentProjectContext";
import { useTangentBaseUrl } from "./hooks/useTangentBaseUrl";
import { useTangentEmbedToken } from "./hooks/useTangentEmbedToken";
import {
  tangentChannelUrl,
  useTangentRuntime,
} from "./hooks/useTangentRuntime";

function ProjectGone() {
  return (
    <BlockStack fill align="center" gap="2" className="p-10">
      <Text size="sm" weight="semibold">
        Project not found
      </Text>
      <Text size="sm" tone="subdued">
        It has been deleted, or you do not have access to it.
      </Text>
      <Link to={APP_ROUTES.PROJECTS} className="text-sm underline">
        Back to projects
      </Link>
    </BlockStack>
  );
}

/** The page owns the app bar here, so every state before the workspace gets it too. */
function ProjectPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <ProjectHeader />
      <div className="grid min-h-0 flex-1">{children}</div>
    </div>
  );
}

function LoadingProject() {
  return (
    <BlockStack fill align="center" gap="1" className="p-10">
      <Text size="sm" weight="semibold">
        Loading project…
      </Text>
    </BlockStack>
  );
}

export function TangentProjectPage() {
  const params = useParams({ strict: false });
  const projectId =
    "projectId" in params && typeof params.projectId === "string"
      ? params.projectId
      : null;

  if (!projectId) {
    return (
      <ProjectPageFrame>
        <BlockStack fill align="center" gap="1" className="p-10">
          <Text size="sm" weight="semibold">
            Project not found
          </Text>
        </BlockStack>
      </ProjectPageFrame>
    );
  }

  return <TangentProjectPageContent projectId={projectId} />;
}

function TangentProjectPageContent({ projectId }: { projectId: string }) {
  const { resolvedTheme } = useTheme();
  const { error: projectError } = useProject(projectId);
  const { baseUrl, localAddress, isLoading, isError } =
    useTangentBaseUrl(projectId);
  useTrackRecentlyViewedProject(projectId);
  const channelUrl = tangentChannelUrl(baseUrl);
  const runtime = useTangentRuntime(channelUrl);
  const getToken = useTangentEmbedToken(baseUrl);
  const framed = (content: ReactNode) => (
    <ProjectPageFrame>{content}</ProjectPageFrame>
  );

  // Before the loading branch: a project that is gone never resolves a
  // workspace to take a Tangent url from, so waiting on one waits forever.
  if (projectError) {
    return framed(<ProjectGone />);
  }

  if (isLoading) {
    return framed(<LoadingProject />);
  }

  if (isError) {
    return framed(
      <BlockStack fill align="center" gap="1" className="p-10">
        <Text size="sm" weight="semibold">
          Project unavailable
        </Text>
        <Text size="sm" tone="subdued">
          This project could not be loaded. The projects service may not be
          available in this environment.
        </Text>
      </BlockStack>,
    );
  }

  // Ahead of the runtime states: with no url there is nothing to import, so
  // `runtime` sits on `loading` forever and the page would never settle.
  if (!baseUrl) {
    return framed(
      <TangentUnreachable baseUrl={null} localAddress={localAddress} />,
    );
  }

  if (runtime === "loading") {
    return framed(<LoadingProject />);
  }

  if (runtime === "unreachable") {
    return framed(<TangentUnreachable baseUrl={baseUrl} />);
  }

  const { socketUrl, socketPath } = getTangentSocketConfig(baseUrl);

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-100 dark:bg-background">
      <TangentProvider
        key={baseUrl}
        baseUrl={baseUrl}
        channelUrl={channelUrl ?? undefined}
        colorScheme={resolvedTheme}
        socketUrl={socketUrl}
        socketPath={socketPath}
        getToken={getToken}
        anchorProtocols={tangentAnchorProtocols}
      >
        <SharedStoreProvider>
          <TangentProjectProvider projectId={projectId}>
            <DialogProvider>
              <TangentProjectWorkspace />
            </DialogProvider>
          </TangentProjectProvider>
        </SharedStoreProvider>
      </TangentProvider>
    </div>
  );
}
