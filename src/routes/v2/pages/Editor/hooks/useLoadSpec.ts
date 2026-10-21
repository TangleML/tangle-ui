import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import * as yaml from "js-yaml";
import { autorun } from "mobx";
import {
  registerRootStore,
  type UndoStore as MobxUndoStore,
} from "mobx-keystone";
import { useEffect } from "react";

import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";
import {
  type ComponentSpec,
  type IdGenerator,
  IncrementingIdGenerator,
  ReplayIdGenerator,
  serializeComponentSpecToText,
  YamlDeserializer,
} from "@/models/componentSpec";
import { DocumentSaveState } from "@/routes/v2/pages/Editor/store/documentSaveState";
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
  getRemotePipelineDeletionError,
  subscribeRemotePipelineDeletion,
} from "@/services/pipelineStorage/remotePipelineDeletion";
import {
  type EditorPipelineRef,
  getEditorPipelineIdentity,
  isRemotePipelineDraftRef,
  type RemotePipelineRef,
} from "@/services/pipelineStorage/types";
import { PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

import {
  EDITOR_SPEC_QUERY_KEY,
  reconcileDeletedRemotePipeline,
} from "./deletedRemotePipelineCache";

export { EDITOR_SPEC_QUERY_KEY } from "./deletedRemotePipelineCache";

interface LoadedSpec {
  spec: ComponentSpec;
  file: PipelineFile;
  saveState: DocumentSaveState;
  restoredUndoStore?: MobxUndoStore;
}

function deserializeSpec(data: unknown, idGen?: IdGenerator): ComponentSpec {
  const generator = idGen ?? new IncrementingIdGenerator();
  const deserializer = new YamlDeserializer(generator);
  const spec = deserializer.deserialize(data);
  registerRootStore(spec);
  return spec;
}

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

      return {
        ...loadedSpec,
        file,
        saveState: new DocumentSaveState(
          serializeComponentSpecToText(loadedSpec.spec),
        ),
      };
    },
    // Mutable MobX models must not be replaced by background refetches. Remote
    // documents remain recoverable until every edit has reached the server.
    staleTime: Infinity,
    gcTime: remote ? Infinity : undefined,
    retry: false,
  });

  const { file } = query.data;
  useEffect(() => {
    function reconcile() {
      const remote =
        file.remote &&
        ({ source: "remote", ...file.remote } satisfies RemotePipelineRef);
      const error = remote && getRemotePipelineDeletionError(remote);
      if (remote && error) {
        void reconcileDeletedRemotePipeline(queryClient, remote, error);
      }
    }
    reconcile();
    return subscribeRemotePipelineDeletion((deletion) => {
      if (deletion.state === "deleted" || deletion.state === "uncertain")
        reconcile();
    });
  }, [file, queryClient]);
  useEffect(
    () =>
      autorun(() => {
        if (!file.remote) return;
        addRecentlyViewed({
          type: "remote-pipeline",
          id: file.remote.pipelineId,
          name: file.storageKey,
        });
      }),
    [file],
  );

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
          if (!cached || cached.getObserversCount()) return;
          query.data.saveState.releaseWhenSaved(() => {
            if (cached.getObserversCount()) return;
            if (queryClient.getQueryCache().get(cached.queryHash) !== cached)
              return;
            queryClient.removeQueries({ queryKey: key, exact: true });
            if (isRemotePipelineDraftRef(ref)) storage.discardRemoteDraft(ref);
          });
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
  }, [
    queryClient,
    storage,
    identity,
    localFileId,
    localName,
    remote,
    query.data,
  ]);

  return query;
}

function deserializeSpecData(
  specData: unknown,
  undoHistory: Awaited<ReturnType<typeof loadUndoHistory>> | null,
): Omit<LoadedSpec, "file" | "saveState"> {
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

  return {
    spec: deserializeSpec(specData),
    restoredUndoStore: createUndoStoreWithEvents([]),
  };
}
