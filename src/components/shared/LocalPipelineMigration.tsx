import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { invalidatePipelineQueries } from "@/services/pipelineStorage/invalidatePipelineQueries";
import { createsLocalPipelines } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { assertPipelineMigrationBackend } from "@/services/pipelineStorage/pipelineMigrations";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import {
  getEditorPipelineIdentity,
  type PipelineRef,
} from "@/services/pipelineStorage/types";
import { invalidateProjectResources } from "@/services/projects/useProjectResources";

import { LoadingScreen } from "./LoadingScreen";
import { migrateLocalPipelineOnOpen } from "./migrateLocalPipelineOnOpen";

interface LocalPipelineMigrationProps {
  pipelineRef: PipelineRef;
  projectId?: string;
  onMigrated: (file: PipelineFile, clearProjectContext?: boolean) => void;
  children: ReactNode;
}

export function LocalPipelineMigration(props: LocalPipelineMigrationProps) {
  const tourMode = useTourMode();
  const { backendUrl, ready } = useBackend();
  if (tourMode) return props.children;
  return (
    <MigrateLocalPipeline
      key={`${getEditorPipelineIdentity(props.pipelineRef)}:${backendUrl}:${props.projectId ?? ""}`}
      {...props}
      backendUrl={backendUrl}
      ready={ready}
    />
  );
}

function MigrateLocalPipeline({
  pipelineRef,
  projectId,
  onMigrated,
  children,
  backendUrl,
  ready,
}: LocalPipelineMigrationProps & { backendUrl: string; ready: boolean }) {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const mounted = useRef(false);
  const started = useRef(false);
  const [keepLocal, setKeepLocal] = useState(false);
  const consentKey = `local-pipeline-migration-consent-v1:${backendUrl}`;
  const [hasConsent] = useState(() => {
    try {
      return localStorage.getItem(consentKey) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const {
    data: file,
    isPending,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "local-pipeline-migration",
      getEditorPipelineIdentity(pipelineRef),
      projectId,
      backendUrl,
    ],
    queryFn: async () => {
      const resolved = await storage.resolvePipeline(pipelineRef);
      if (resolved.remote)
        assertPipelineMigrationBackend(resolved.remote, backendUrl);
      return resolved;
    },
    select: (resolved) => {
      if (resolved.remote)
        assertPipelineMigrationBackend(resolved.remote, backendUrl);
      return resolved;
    },
    enabled: ready,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const migration = useMutation({
    mutationFn: (local: PipelineFile) =>
      migrateLocalPipelineOnOpen(
        storage,
        local,
        pipelineRef,
        backendUrl,
        projectId,
      ),
    onSuccess: ({
      file: remote,
      warning,
      hasLocalChanges,
      projectUnavailable,
    }) => {
      invalidatePipelineQueries(queryClient, backendUrl);
      if (projectId) invalidateProjectResources(queryClient, projectId);
      if (!mounted.current || hasLocalChanges) return;
      if (warning) notify(warning, "warning");
      if (projectUnavailable) onMigrated(remote, true);
      else onMigrated(remote);
    },
  });
  const driver = file?.folder.driver.type;
  const shouldMigrate = Boolean(
    file &&
    !createsLocalPipelines() &&
    backendUrl.trim() &&
    (driver === "root-indexdb" || driver === "folder-indexdb"),
  );
  useEffect(() => {
    if (
      !file ||
      isFetching ||
      started.current ||
      (!file.remote && (!shouldMigrate || !hasConsent))
    )
      return;
    started.current = true;
    migration.mutate(file);
  }, [file, hasConsent, isFetching, migration, shouldMigrate]);

  if (error)
    return (
      <BlockStack fill align="center" inlineAlign="center" gap="3">
        <Paragraph role="alert">{error.message}</Paragraph>
        <Button variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </BlockStack>
    );
  if (migration.data?.hasLocalChanges) {
    const recovered = migration.data;
    return (
      <BlockStack fill gap="2">
        <Paragraph role="alert">
          {recovered.warning} You can recover your edits in the local editor
          below.
        </Paragraph>
        <Button
          variant="outline"
          onClick={() =>
            recovered.projectUnavailable
              ? onMigrated(recovered.file, true)
              : onMigrated(recovered.file)
          }
        >
          Open uploaded pipeline
        </Button>
        {children}
      </BlockStack>
    );
  }
  if (
    isPending ||
    isFetching ||
    !file ||
    migration.isPending ||
    migration.isSuccess ||
    file.remote
  ) {
    return <LoadingScreen message="Opening pipeline..." />;
  }
  if (migration.error)
    return (
      <BlockStack fill gap="2">
        <Paragraph role="alert">
          Could not move this pipeline to {backendUrl}.{" "}
          {migration.error.message} Your local copy is still available below.
        </Paragraph>
        <Button variant="outline" onClick={() => migration.mutate(file)}>
          Retry upload
        </Button>
        {children}
      </BlockStack>
    );
  if (!shouldMigrate || keepLocal) return children;
  return (
    <>
      <LoadingScreen message="Choose where to open this pipeline" />
      <ConfirmationDialog
        isOpen
        title={`Move "${file.storageKey}" to the backend?`}
        description={`This saves the pipeline and its configured input values to ${backendUrl}. Other users with read access to that backend can see them. The browser copy is removed only after a successful move. Folder placement and edit history are not transferred. Cancel keeps editing in this browser.`}
        dismissForeverKey={consentKey}
        onConfirm={() => migration.mutate(file)}
        onCancel={() => setKeepLocal(true)}
      />
    </>
  );
}
