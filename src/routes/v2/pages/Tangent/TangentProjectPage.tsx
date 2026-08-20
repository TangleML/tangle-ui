import { TangentProvider } from "@tangent/embed-react";
import { useParams } from "@tanstack/react-router";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { SharedStoreProvider } from "@/routes/v2/shared/store/SharedStoreContext";
import { TANGENT_BASE_URL } from "@/utils/constants";

import { TangentProjectWorkspace } from "./components/TangentProjectWorkspace";
import { TangentProjectProvider } from "./context/TangentProjectContext";

export function TangentProjectPage() {
  const { theme } = useTheme();
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
    <div className="h-full w-full select-none bg-slate-100 dark:bg-background">
      <TangentProvider baseUrl={TANGENT_BASE_URL} colorScheme={theme}>
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
