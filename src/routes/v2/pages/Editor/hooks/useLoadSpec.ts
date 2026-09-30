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
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  getLastForeignWriteTime,
  subscribePipelineFileChanged,
} from "@/services/pipelineStorage/pipelineFileEvents";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

interface LoadedSpec {
  spec: ComponentSpec;
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

export function useLoadSpec(
  file: Pick<
    PipelineFile,
    "id" | "storageKind" | "storageKey" | "referenceId" | "read"
  >,
  sessionId: string,
) {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();
  const queryKey = [EDITOR_SPEC_QUERY_KEY, storage.scope, file.id, sessionId];

  // When the v1 editor writes to the same IndexedDB file, drop our cached
  // deserialization so the next read of this query goes back to disk. We
  // ignore "v2" emissions because those are our own autosaves — reloading the
  // spec under our feet would discard MobX editor state (selection, undo, …)
  // and the in-memory model is already authoritative for v2.
  useEffect(() => {
    const matchKey = [EDITOR_SPEC_QUERY_KEY, storage.scope, file.id, sessionId];

    const state = queryClient.getQueryState(matchKey);
    const lastFetched = state?.dataUpdatedAt;
    if (lastFetched !== undefined) {
      const candidates = [file.storageKey, file.id];
      const lastForeign = candidates
        .map((key) => getLastForeignWriteTime(key, "v2") ?? 0)
        .reduce((a, b) => Math.max(a, b), 0);
      if (lastForeign > lastFetched) {
        queryClient.invalidateQueries({ queryKey: matchKey });
      }
    }

    return subscribePipelineFileChanged(({ storageKey, source }) => {
      if (source === "v2") return;
      if (storageKey !== file.storageKey && storageKey !== file.id) return;
      queryClient.invalidateQueries({ queryKey: matchKey });
    });
  }, [queryClient, file.id, file.storageKey, storage.scope, sessionId]);

  return useSuspenseQuery({
    queryKey,
    queryFn: async (): Promise<LoadedSpec> => {
      const yamlContent = await file.read();
      const undoHistory =
        file.storageKind === "local"
          ? await loadUndoHistory(file.referenceId).catch(() => null)
          : null;
      const specData = yaml.load(yamlContent, PIPELINE_YAML_LOAD_OPTIONS);

      const loadedSpec = deserializeSpecData(specData, undoHistory);
      await hydrateLoadedSpecRefs(loadedSpec.spec);

      return loadedSpec;
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

function deserializeSpecData(
  specData: unknown,
  undoHistory: Awaited<ReturnType<typeof loadUndoHistory>> | null,
): LoadedSpec {
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
