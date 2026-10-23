import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { pipelineStorageDb } from "@/services/pipelineStorage/db";
import { invalidatePipelineQueries } from "@/services/pipelineStorage/invalidatePipelineQueries";
import { migrateLocalPipelineOnOpen } from "@/services/pipelineStorage/migrateLocalPipelineOnOpen";
import { createsLocalPipelines } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  hasPipelineMigrationConsent,
  pipelineMigrationConsentKey,
  subscribePipelineMigrationConsent,
} from "@/services/pipelineStorage/pipelineMigrationConsent";
import {
  assertPipelineMigrationBackend,
  PipelineMovedToBackendError,
} from "@/services/pipelineStorage/pipelineMigrations";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import {
  getEditorPipelineIdentity,
  type PipelineRef,
} from "@/services/pipelineStorage/types";
import { invalidateProjectResources } from "@/services/projects/useProjectResources";
import { getRemotePipelineWriter } from "@/services/remotePipelineEditorService";
import { RemotePipelineQueryKeys } from "@/services/remotePipelineQueryKeys";

import { LoadingScreen } from "./LoadingScreen";

interface LocalPipelineMigrationProps {
  pipelineRef: PipelineRef;
  projectId?: string;
  isActive?: boolean;
  onMigrated: (file: PipelineFile, clearProjectContext?: boolean) => void;
  children: ReactNode;
}

export function LocalPipelineMigration(props: LocalPipelineMigrationProps) {
  const tourMode = useTourMode();
  const { backendUrl, ready } = useBackend();
  const storage = usePipelineStorage();
  const {
    data: resolved,
    isFetching,
    isPlaceholderData,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "local-pipeline-migration",
      getEditorPipelineIdentity(props.pipelineRef),
      backendUrl,
    ],
    queryFn: async () => {
      const resolved = await storage.resolvePipeline(props.pipelineRef);
      if (resolved.remote)
        assertPipelineMigrationBackend(resolved.remote, backendUrl);
      const attempt = await pipelineStorageDb.pipeline_migration_attempts.get(
        resolved.id,
      );
      return { file: resolved, keepLocalCopy: attempt?.keepLocalCopy === true };
    },
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey.at(-1) === backendUrl &&
      previous?.file.id === props.pipelineRef.fileId
        ? previous
        : undefined,
    select: (resolved) => {
      if (resolved.file.remote)
        assertPipelineMigrationBackend(resolved.file.remote, backendUrl);
      return resolved;
    },
    enabled: ready && !tourMode,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const file = resolved?.file;
  if (tourMode) return props.children;
  if (error)
    return (
      <BlockStack fill align="center" inlineAlign="center" gap="3">
        <Paragraph role="alert">{error.message}</Paragraph>
        <Button variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </BlockStack>
    );
  if (!file || (isFetching && !isPlaceholderData))
    return <LoadingScreen message="Opening pipeline..." />;
  return (
    <MigrateLocalPipeline
      key={`${file.id}:${backendUrl}`}
      {...props}
      file={file}
      keepLocalCopy={resolved?.keepLocalCopy ?? false}
      isFetching={isFetching}
      refetch={refetch}
      backendUrl={backendUrl}
      ready={ready}
    />
  );
}

function MigrateLocalPipeline({
  pipelineRef,
  projectId,
  isActive = true,
  onMigrated,
  children,
  file,
  keepLocalCopy,
  isFetching,
  refetch,
  backendUrl,
  ready,
}: LocalPipelineMigrationProps & {
  file: PipelineFile;
  keepLocalCopy: boolean;
  isFetching: boolean;
  refetch: () => unknown;
  backendUrl: string;
  ready: boolean;
}) {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const mounted = useRef(false);
  const started = useRef(false);
  const [keepLocal, setKeepLocal] = useState(false);
  const consentKey = pipelineMigrationConsentKey(backendUrl);
  const hasConsent = useSyncExternalStore(
    subscribePipelineMigrationConsent,
    () => hasPipelineMigrationConsent(backendUrl),
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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
      else if (hasConsent && !file.remote)
        notify(
          `Pipeline ${keepLocalCopy ? "uploaded" : "moved"} to ${backendUrl}.`,
          "success",
        );
      if (projectUnavailable) onMigrated(remote, true);
      else onMigrated(remote);
    },
  });
  const driver = file?.folder.driver.type;
  const shouldMigrate = Boolean(
    file &&
    !createsLocalPipelines() &&
    backendUrl.trim() &&
    (!keepLocalCopy || projectId) &&
    (driver === "root-indexdb" || driver === "folder-indexdb"),
  );
  const writer = useQuery({
    queryKey: RemotePipelineQueryKeys.Writer(backendUrl),
    queryFn: () => getRemotePipelineWriter(backendUrl),
    enabled: ready && isActive && shouldMigrate && !isFetching,
    retry: false,
  });
  useEffect(() => {
    if (
      !isActive ||
      !file ||
      isFetching ||
      started.current ||
      (!file.remote && (!shouldMigrate || !hasConsent || !writer.isSuccess))
    )
      return;
    started.current = true;
    migration.mutate(file);
  }, [
    file,
    hasConsent,
    isFetching,
    isActive,
    migration,
    shouldMigrate,
    writer.isSuccess,
  ]);

  if (migration.error instanceof PipelineMovedToBackendError)
    return (
      <BlockStack fill align="center" inlineAlign="center" gap="3">
        <Paragraph role="alert">{migration.error.message}</Paragraph>
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
  if (migration.isPending || migration.isSuccess || file.remote) {
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
  if (!shouldMigrate || keepLocal || writer.isError) return children;
  if (!isActive || !writer.isSuccess)
    return <LoadingScreen message="Opening pipeline..." />;
  return (
    <>
      <LoadingScreen message="Choose where to open this pipeline" />
      <ConfirmationDialog
        isOpen
        title={`${keepLocalCopy ? "Upload" : "Move"} "${file.storageKey}" to the server?`}
        description={`This saves the pipeline and its configured input values to ${backendUrl}. Other users with read access to that backend can see them. ${keepLocalCopy ? "The browser copy is kept." : "The browser copy is removed only after a successful move."} Folder placement and edit history are not transferred. Cancel keeps editing in this browser.`}
        confirmLabel={keepLocalCopy ? "Upload" : "Move"}
        dismissForeverKey={consentKey}
        dismissForeverLabel={`Move pipelines I open to ${backendUrl} without asking`}
        onConfirm={() => migration.mutate(file)}
        onCancel={() => setKeepLocal(true)}
      />
    </>
  );
}
