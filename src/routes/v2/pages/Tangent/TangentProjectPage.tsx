import "@/routes/v2/pages/Tangent/workarea/registerKinds";

import { TangentProvider } from "@tangent/embed-react";
import { useParams } from "@tanstack/react-router";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { getTangentSocketConfig } from "@/routes/v2/pages/Tangent/services/socketConfig";
import { SharedStoreProvider } from "@/routes/v2/shared/store/SharedStoreContext";
import { TOP_NAV_HEIGHT } from "@/utils/constants";

import { TangentProjectWorkspace } from "./components/TangentProjectWorkspace";
import { TangentProjectProvider } from "./context/TangentProjectContext";
import { useTangentBaseUrl } from "./hooks/useTangentBaseUrl";

export function TangentProjectPage() {
  const params = useParams({ strict: false });
  const projectId =
    "projectId" in params && typeof params.projectId === "string"
      ? params.projectId
      : null;

  if (!projectId) {
    return (
      <BlockStack fill align="center" gap="1" className="p-10">
        <Text size="sm" weight="semibold">
          Project not found
        </Text>
      </BlockStack>
    );
  }

  return <TangentProjectPageContent projectId={projectId} />;
}

function TangentProjectPageContent({ projectId }: { projectId: string }) {
  const { resolvedTheme } = useTheme();
  const { baseUrl, isLoading, isError } = useTangentBaseUrl(projectId);

  if (isLoading) {
    return (
      <BlockStack fill align="center" gap="1" className="p-10">
        <Text size="sm" weight="semibold">
          Loading project…
        </Text>
      </BlockStack>
    );
  }

  if (isError) {
    return (
      <BlockStack fill align="center" gap="1" className="p-10">
        <Text size="sm" weight="semibold">
          Project unavailable
        </Text>
        <Text size="sm" tone="subdued">
          This project could not be loaded. The projects service may not be
          available in this environment.
        </Text>
      </BlockStack>
    );
  }

  const { socketUrl, socketPath } = getTangentSocketConfig(baseUrl);

  return (
    <div
      className="w-full overflow-hidden bg-slate-100 dark:bg-background"
      style={{ height: `calc(100vh - ${TOP_NAV_HEIGHT}px)` }}
    >
      <TangentProvider
        key={baseUrl}
        baseUrl={baseUrl}
        colorScheme={resolvedTheme}
        socketUrl={socketUrl}
        socketPath={socketPath}
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
