import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import * as yaml from "js-yaml";
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
  getUndoHistoryKey,
  loadUndoHistory,
} from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  getLastForeignWriteTime,
  subscribePipelineFileChanged,
} from "@/services/pipelineStorage/pipelineFileEvents";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import {
  type EditorPipelineRef,
  getEditorPipelineIdentity,
  isRemotePipelineDraftRef,
} from "@/services/pipelineStorage/types";
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

export const EDITOR_SPEC_QUERY_KEY = "editor-v2-spec";

export function useLoadSpec(ref: EditorPipelineRef) {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();
  const identity = getEditorPipelineIdentity(ref);
  const remote = "source" in ref;
  const localName = remote ? undefined : ref.name;
  const localFileId = remote ? undefined : ref.fileId;
  const queryKey = [EDITOR_SPEC_QUERY_KEY, identity];

  const query = useSuspenseQuery({
    queryKey,
    queryFn: async (): Promise<LoadedSpec> => {
      const file = await storage.resolvePipeline(ref);
      const yamlContent = await file.read();
      const specData = yaml.load(yamlContent, PIPELINE_YAML_LOAD_OPTIONS);
      const undoHistory = file.isDraft
        ? null
        : await loadUndoHistory(
            getUndoHistoryKey(file),
            file.remote ? yamlContent : undefined,
          ).catch(() => null);

      const loadedSpec = deserializeSpecData(specData, undoHistory);
      await hydrateLoadedSpecRefs(loadedSpec.spec);

      return { ...loadedSpec, file };
    },
    // Mutable MobX models must not be replaced by background refetches. Remote
    // documents leave the cache on close, so reopening reads the server again.
    staleTime: Infinity,
    gcTime: remote ? 0 : undefined,
    retry: false,
  });

  // When the v1 editor writes to the same IndexedDB file, drop our cached
  // deserialization so the next read of this query goes back to disk. We
  // ignore "v2" emissions because those are our own autosaves — reloading the
  // spec under our feet would discard MobX editor state (selection, undo, …)
  // and the in-memory model is already authoritative for v2.
  useEffect(() => {
    if (remote) {
      return () => {
        // StrictMode reconnects observers after replaying effect cleanup.
        // Wait for that before evicting a genuinely closed document.
        queueMicrotask(() => {
          const key = [EDITOR_SPEC_QUERY_KEY, identity];
          const cached = queryClient
            .getQueryCache()
            .find({ queryKey: key, exact: true });
          if (cached?.getObserversCount()) return;
          queryClient.removeQueries({
            queryKey: key,
            exact: true,
            type: "inactive",
          });
          if (isRemotePipelineDraftRef(ref)) storage.discardRemoteDraft(ref);
        });
      };
    }
    const matchKey = [EDITOR_SPEC_QUERY_KEY, identity];

    const state = queryClient.getQueryState(matchKey);
    const lastFetched = state?.dataUpdatedAt;
    if (lastFetched !== undefined) {
      const candidates = [localName, localFileId].filter(
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
      if (storageKey !== localName && storageKey !== localFileId) return;
      queryClient.invalidateQueries({ queryKey: matchKey });
    });
  }, [queryClient, storage, identity, localFileId, localName, remote]);

  return query;
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
