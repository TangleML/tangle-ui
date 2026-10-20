import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { invalidatePipelineQueries } from "@/services/pipelineStorage/invalidatePipelineQueries";
import {
  createsLocalPipelines,
  getPipelineCreationBackendUrl,
} from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { assertPipelineMigrationBackend } from "@/services/pipelineStorage/pipelineMigrations";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import {
  getEditorPipelineIdentity,
  type PipelineRef,
} from "@/services/pipelineStorage/types";
import { moveLocalPipelineResourceToRemote } from "@/services/projects/moveLocalPipelineResourceToRemote";
import { invalidateProjectResources } from "@/services/projects/useProjectResources";

import { LoadingScreen } from "./LoadingScreen";

interface LocalPipelineMigrationProps {
  pipelineRef: PipelineRef;
  projectId?: string;
  onMigrated: (file: PipelineFile) => void;
  children: ReactNode;
}

export function LocalPipelineMigration(props: LocalPipelineMigrationProps) {
  const tourMode = useTourMode();
  if (tourMode) return props.children;
  return <MigrateLocalPipeline {...props} />;
}

function MigrateLocalPipeline({
  pipelineRef,
  projectId,
  onMigrated,
  children,
}: LocalPipelineMigrationProps) {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();
  const { backendUrl: activeBackendUrl, ready } = useBackend();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: [
      "local-pipeline-migration",
      getEditorPipelineIdentity(pipelineRef),
      projectId,
      activeBackendUrl,
    ],
    queryFn: async ({ signal }) => {
      const local = await storage.resolvePipeline(pipelineRef);
      signal.throwIfAborted();
      if (local.remote) {
        assertPipelineMigrationBackend(local.remote, activeBackendUrl);
      }
      const driver = local.folder.driver.type;
      if (
        !local.remote &&
        (createsLocalPipelines() ||
          (driver !== "root-indexdb" && driver !== "folder-indexdb"))
      ) {
        return null;
      }
      const backendUrl =
        local.remote?.backendUrl ?? (await getPipelineCreationBackendUrl());
      signal.throwIfAborted();
      const remote = local.remote
        ? local
        : await storage.moveLocalPipelineToRemote(
            local,
            backendUrl,
            projectId
              ? async (file) => {
                  signal.throwIfAborted();
                  if (file.remote) {
                    assertPipelineMigrationBackend(
                      file.remote,
                      activeBackendUrl,
                    );
                  }
                  await moveLocalPipelineResourceToRemote(
                    projectId,
                    local,
                    file,
                  );
                }
              : undefined,
          );
      signal.throwIfAborted();
      if (local.remote && projectId) {
        await moveLocalPipelineResourceToRemote(
          projectId,
          { id: pipelineRef.fileId ?? "", storageKey: pipelineRef.name },
          remote,
        );
      }
      invalidatePipelineQueries(queryClient, backendUrl);
      if (projectId) {
        invalidateProjectResources(queryClient, projectId);
      }
      return remote;
    },
    select: (file) => {
      if (file?.remote) {
        assertPipelineMigrationBackend(file.remote, activeBackendUrl);
      }
      return file;
    },
    enabled: ready,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (data && data.remote?.backendUrl === activeBackendUrl) onMigrated(data);
  }, [activeBackendUrl, data, onMigrated]);

  if (error) {
    return (
      <BlockStack fill align="center" inlineAlign="center" gap="3">
        <Paragraph role="alert">{error.message}</Paragraph>
        <Button variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </BlockStack>
    );
  }
  if (isPending || data) {
    return <LoadingScreen message="Opening pipeline..." />;
  }
  return children;
}
