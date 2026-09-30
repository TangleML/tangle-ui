import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { PermissionStatus } from "@/services/pipelineStorage/types";

interface DriverPermissionGateProps {
  file: PipelineFile;
  children: ReactNode;
}

export function DriverPermissionGate({
  file,
  children,
}: DriverPermissionGateProps) {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();
  const [isRequesting, setIsRequesting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["driver-permission-gate", storage.scope, file.id],
    queryFn: async (): Promise<{
      status: PermissionStatus;
      folder: PipelineFolder | null;
    }> => {
      const folder = file.folder;
      if (!folder?.requiresPermission) {
        return { status: "granted", folder };
      }
      const status = await folder.driver.permissions!.check();
      return { status, folder };
    },
    staleTime: 0,
  });

  if (isLoading || !data) {
    return (
      <BlockStack fill align="center" inlineAlign="center">
        <Spinner />
      </BlockStack>
    );
  }

  if (data.status === "granted") {
    return <>{children}</>;
  }

  const handleGrantAccess = async () => {
    const folder = data.folder;
    if (!folder?.driver.permissions) return;

    setIsRequesting(true);
    try {
      const granted = await folder.driver.permissions.request();
      if (granted) {
        queryClient.invalidateQueries({
          queryKey: ["driver-permission-gate"],
        });
      }
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <BlockStack fill align="center" inlineAlign="center" gap="4">
      <Icon name="ShieldAlert" className="size-12 text-muted-foreground" />
      <Heading level={2} size="lg" weight="semibold">
        Permission Required
      </Heading>
      <Text tone="subdued" className="text-center max-w-md">
        This pipeline is stored in &ldquo;{data.folder?.name}&rdquo; which
        requires access permission.
      </Text>
      <Button
        variant="outline"
        onClick={handleGrantAccess}
        disabled={isRequesting}
      >
        {isRequesting ? (
          <Spinner className="size-4" />
        ) : (
          <Icon name="KeyRound" size="sm" />
        )}
        Grant Access
      </Button>
    </BlockStack>
  );
}
