import { useParams } from "@tanstack/react-router";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTangentSettings } from "@/hooks/useTangentSettings";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { SharedStoreProvider } from "@/routes/v2/shared/store/SharedStoreContext";
import { TangentEmbedProvider } from "@/routes/v2/shared/tangent/TangentEmbedProvider";
import { TOP_NAV_HEIGHT } from "@/utils/constants";

import { TangentProjectWorkspace } from "./components/TangentProjectWorkspace";
import { TangentProjectProvider } from "./context/TangentProjectContext";

export function TangentProjectPage() {
  const { theme } = useTheme();
  const { baseUrl } = useTangentSettings();
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

  return (
    <div
      className="w-full overflow-hidden bg-slate-100 dark:bg-background"
      style={{ height: `calc(100vh - ${TOP_NAV_HEIGHT}px)` }}
    >
      <TangentEmbedProvider key={baseUrl} baseUrl={baseUrl} colorScheme={theme}>
        <SharedStoreProvider>
          <TangentProjectProvider projectId={projectId}>
            <DialogProvider>
              <TangentProjectWorkspace />
            </DialogProvider>
          </TangentProjectProvider>
        </SharedStoreProvider>
      </TangentEmbedProvider>
    </div>
  );
}
