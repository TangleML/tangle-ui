import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import yaml from "js-yaml";
import {
  registerRootStore,
  type UndoStore as MobxUndoStore,
} from "mobx-keystone";
import { useEffect } from "react";

import {
  type ComponentSpec,
  type IdGenerator,
  IncrementingIdGenerator,
  ReplayIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { hydrateLoadedSpecRefs } from "@/routes/v2/pages/Editor/utils/hydrateSpecRefs";
import {
  createUndoStoreWithEvents,
  loadUndoHistory,
} from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import { RootFolderDbStorageDriver } from "@/services/pipelineStorage/drivers/RootFolderDbStorageDriver";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  getLastForeignWriteTime,
  subscribePipelineFileChanged,
} from "@/services/pipelineStorage/pipelineFileEvents";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import type { PipelineRef } from "@/services/pipelineStorage/types";
import { PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

interface LoadedSpec {
  spec: ComponentSpec;
  file: PipelineFile;
  restoredUndoStore?: MobxUndoStore;
}

function deserializeSpec(data: unknown, idGen?: IdGenerator): ComponentSpec {
  const generator = idGen ?? new IncrementingIdGenerator();
  const deserializer = new YamlDeserializer(generator);
  const spec = deserializer.deserialize(data);
  registerRootStore(spec);
  return spec;
}

async function backfillFromLegacyStore(
  name: string,
  storage: PipelineStorageService,
): Promise<PipelineFile | undefined> {
  const legacyDriver = new RootFolderDbStorageDriver();

  const existsInLegacy = await legacyDriver.hasKey(name);
  if (!existsInLegacy) return undefined;

  const file = await storage.rootFolder.assignFile(name);
  return storage.findPipelineById(file.id);
}

async function resolveSpecFile(
  ref: PipelineRef,
  storage: PipelineStorageService,
): Promise<PipelineFile> {
  let pipelineFile = ref.fileId
    ? await storage.findPipelineById(ref.fileId)
    : await storage.resolvePipelineByName(ref.name);

  if (!pipelineFile) {
    pipelineFile = await backfillFromLegacyStore(ref.name, storage);
  }

  if (!pipelineFile) {
    throw new Error(`Pipeline "${ref.name}" not found`);
  }
  return pipelineFile;
}

export const EDITOR_SPEC_QUERY_KEY = "editor-v2-spec";

export function useLoadSpec(ref: PipelineRef, sessionId: string) {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();
  // The session is created above Suspense so mounting retries share one query,
  // but reopening a remote pipeline always reads the current server definition.
  const remoteSessionId = storage.remoteEnabled ? sessionId : undefined;
  const queryKey = [
    EDITOR_SPEC_QUERY_KEY,
    storage.scope,
    ref.fileId ?? ref.name,
    remoteSessionId,
  ];

  // When the v1 editor writes to the same IndexedDB file, drop our cached
  // deserialization so the next read of this query goes back to disk. We
  // ignore "v2" emissions because those are our own autosaves — reloading the
  // spec under our feet would discard MobX editor state (selection, undo, …)
  // and the in-memory model is already authoritative for v2.
  useEffect(() => {
    const matchKey = [
      EDITOR_SPEC_QUERY_KEY,
      storage.scope,
      ref.fileId ?? ref.name,
      remoteSessionId,
    ];

    const state = queryClient.getQueryState(matchKey);
    const lastFetched = state?.dataUpdatedAt;
    if (lastFetched !== undefined) {
      const candidates = [ref.name, ref.fileId].filter(
        (k): k is string => typeof k === "string",
      );
      const lastForeign = candidates
        .map((key) => getLastForeignWriteTime(key, "v2") ?? 0)
        .reduce((a, b) => Math.max(a, b), 0);
      if (lastForeign > lastFetched) {
        queryClient.invalidateQueries({ queryKey: matchKey });
      }
    }

    // Contract: v1 emits with storageKey === the pipeline name, which must
    // match this query's ref.name (or ref.fileId). If v1 ever writes under a
    // different key (e.g. after a rename), invalidation silently stops and v2
    // looks stale until a refresh. This coupling is acceptable only because the
    // v1 editor is slated for removal once v2 becomes the default.
    return subscribePipelineFileChanged(({ storageKey, source }) => {
      if (source === "v2") return;
      if (storageKey !== ref.name && storageKey !== ref.fileId) return;
      queryClient.invalidateQueries({ queryKey: matchKey });
    });
  }, [queryClient, ref.fileId, ref.name, storage.scope, remoteSessionId]);

  return useSuspenseQuery({
    queryKey,
    queryFn: async (): Promise<LoadedSpec> => {
      const file = await resolveSpecFile(ref, storage);
      const yamlContent = await file.read();
      const undoHistory =
        file.storageKind === "local"
          ? await loadUndoHistory(ref.name).catch(() => null)
          : null;
      const specData = yaml.load(yamlContent, PIPELINE_YAML_LOAD_OPTIONS);

      const loadedSpec = deserializeSpecData(specData, undoHistory);
      await hydrateLoadedSpecRefs(loadedSpec.spec);

      return { ...loadedSpec, file };
    },
    staleTime: Infinity,
    refetchOnMount: !storage.remoteEnabled,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

function deserializeSpecData(
  specData: unknown,
  undoHistory: Awaited<ReturnType<typeof loadUndoHistory>> | null,
): Omit<LoadedSpec, "file"> {
  if (undoHistory) {
    try {
      const replayIdGen = new ReplayIdGenerator(undoHistory.idStack);
      const spec = deserializeSpec(specData, replayIdGen);
      const restoredUndoStore = createUndoStoreWithEvents(
        undoHistory.undoEvents,
      );
      return { spec, restoredUndoStore };
    } catch (error) {
      console.warn("Failed to restore undo history, loading fresh:", error);
    }
  }

  return { spec: deserializeSpec(specData) };
}
