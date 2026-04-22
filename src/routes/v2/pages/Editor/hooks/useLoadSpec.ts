import { useSuspenseQuery } from "@tanstack/react-query";
import yaml from "js-yaml";
import {
  registerRootStore,
  type UndoStore as MobxUndoStore,
} from "mobx-keystone";

import {
  type ComponentSpec,
  type IdGenerator,
  IncrementingIdGenerator,
  ReplayIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import {
  createUndoStoreWithEvents,
  loadUndoHistory,
} from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import { RootFolderDbStorageDriver } from "@/services/pipelineStorage/drivers/RootFolderDbStorageDriver";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import type { PipelineRef } from "@/services/pipelineStorage/types";

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

async function backfillFromLegacyStore(
  name: string,
  storage: PipelineStorageService,
): Promise<PipelineFile | undefined> {
  const legacyDriver = new RootFolderDbStorageDriver();

  const existsInLegacy = await legacyDriver.hasKey(name);
  if (!existsInLegacy) return undefined;

  return storage.rootFolder.assignFile(name);
}

async function resolveSpecData(
  ref: PipelineRef,
  storage: PipelineStorageService,
): Promise<unknown> {
  let pipelineFile = ref.fileId
    ? await storage.findPipelineById(ref.fileId)
    : await storage.resolvePipelineByName(ref.name);

  if (!pipelineFile) {
    pipelineFile = await backfillFromLegacyStore(ref.name, storage);
  }

  if (!pipelineFile) {
    throw new Error(`Pipeline "${ref.name}" not found`);
  }
  const yamlContent = await pipelineFile.read();
  return yaml.load(yamlContent);
}

export function useLoadSpec(ref: PipelineRef) {
  const storage = usePipelineStorage();

  return useSuspenseQuery({
    queryKey: ["editor-v2-spec", ref.fileId ?? ref.name],
    queryFn: async (): Promise<LoadedSpec> => {
      const [specData, undoHistory] = await Promise.all([
        resolveSpecData(ref, storage),
        loadUndoHistory(ref.name).catch(() => null),
      ]);

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
    },
    staleTime: Infinity,
    retry: false,
  });
}
