import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";
import type { PermissionStatus } from "@/services/pipelineStorage/types";

import { FoldersQueryKeys } from "../../../types";

interface FolderPermissionBannerProps {
  folder: PipelineFolder;
  onGranted?: () => void;
}

export function FolderPermissionBanner({
  folder,
  onGranted,
}: FolderPermissionBannerProps) {
  const queryClient = useQueryClient();
  const hasObserver = "FileSystemObserver" in globalThis;

  const { data: permission } = useQuery<PermissionStatus>({
    queryKey: [...FoldersQueryKeys.Pipelines(folder.id), "permission"],
    queryFn: () =>
      folder.driver.permissions?.check() ?? Promise.resolve("granted"),
    enabled: folder.requiresPermission,
  });

  const handleRequestPermission = async () => {
    const granted = await folder.driver.permissions?.request();
    if (granted) {
      onGranted?.();
      queryClient.invalidateQueries({
        queryKey: FoldersQueryKeys.All(),
      });
    }
  };

  if (!folder.requiresPermission) return null;

  return (
    <>
      {permission !== undefined && permission !== "granted" && (
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

      {permission === "granted" && !hasObserver && (
        <InlineStack align="end" className="w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={onGranted}
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
