import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import type { UseConnectedFolderPipelinesResult } from "../../../hooks/useConnectedFolderPipelines";
import { requestPermission } from "../../../services/connectedFolderStorage";
import { ConnectedFoldersQueryKeys } from "../../../types";

interface ConnectedFolderPermissionBannerProps {
  connectedFolderContent: Extract<
    UseConnectedFolderPipelinesResult,
    { isConnectedFolder: true }
  >;
}

export function ConnectedFolderPermissionBanner({
  connectedFolderContent,
}: ConnectedFolderPermissionBannerProps) {
  const queryClient = useQueryClient();
  const hasObserver = "FileSystemObserver" in globalThis;

  const handleRequestPermission = async () => {
    if (connectedFolderContent.permission !== "granted") {
      const granted = await requestPermission(connectedFolderContent.handle);
      if (granted) {
        connectedFolderContent.rescan();
        queryClient.invalidateQueries({
          queryKey: ConnectedFoldersQueryKeys.All(),
        });
      }
    }
  };

  return (
    <>
      {connectedFolderContent.permission !== "granted" && (
        <BlockStack align="center" className="py-8" gap="3">
          <Text tone="subdued">
            Permission required to read files from this folder.
          </Text>
          <Button variant="outline" onClick={handleRequestPermission}>
            <Icon name="KeyRound" size="sm" />
            Grant Access
          </Button>
        </BlockStack>
      )}

      {connectedFolderContent.permission === "granted" && !hasObserver && (
        <InlineStack align="end" className="w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={connectedFolderContent.rescan}
            title="Refresh file list"
          >
            <Icon name="RefreshCw" size="sm" />
            Refresh
          </Button>
        </InlineStack>
      )}
    </>
  );
}
