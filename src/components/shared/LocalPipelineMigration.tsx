import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import {
  createsLocalPipelines,
  getPipelineCreationBackendUrl,
} from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import {
  getEditorPipelineIdentity,
  type PipelineRef,
} from "@/services/pipelineStorage/types";
import { moveLocalPipelineResourceToRemote } from "@/services/projects/moveLocalPipelineResourceToRemote";
import { ProjectResourcesQueryKeys } from "@/services/projects/types";

import { LoadingScreen } from "./LoadingScreen";

interface LocalPipelineMigrationProps {
  pipelineRef: PipelineRef;
  projectId?: string;
  onMigrated: (file: PipelineFile) => void;
  children: ReactNode;
}

export function LocalPipelineMigration(props: LocalPipelineMigrationProps) {
  const tourMode = useTourMode();
  if (createsLocalPipelines() || tourMode) return props.children;
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
  const { data, isPending, error, refetch } = useQuery({
    queryKey: [
      "local-pipeline-migration",
      getEditorPipelineIdentity(pipelineRef),
      projectId,
    ],
    queryFn: async () => {
      const local = await storage.resolvePipeline(pipelineRef);
      const driver = local.folder.driver.type;
      if (driver !== "root-indexdb" && driver !== "folder-indexdb") {
        return null;
      }
      const backendUrl = await getPipelineCreationBackendUrl();
      const remote = await storage.moveLocalPipelineToRemote(
        local,
        backendUrl,
        projectId
          ? (file) => moveLocalPipelineResourceToRemote(projectId, local, file)
          : undefined,
      );
      void queryClient.invalidateQueries({
        queryKey: ["remote-pipelines-page", backendUrl],
      });
      void queryClient.invalidateQueries({
        queryKey: ["remote-pipelines", backendUrl],
      });
      if (projectId) {
        void queryClient.invalidateQueries({
          queryKey: ProjectResourcesQueryKeys.All(projectId),
        });
      }
      return remote;
    },
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (data) onMigrated(data);
  }, [data, onMigrated]);

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
    return <LoadingScreen message="Moving pipeline to remote storage..." />;
  }
  return children;
}
