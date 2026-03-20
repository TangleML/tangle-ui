import { useSuspenseQuery } from "@tanstack/react-query";
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
import { loadPipelineByName } from "@/services/pipelineService";

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

export function useLoadSpec(pipelineName: string) {
  return useSuspenseQuery({
    queryKey: ["editor-v2-spec", pipelineName],
    queryFn: async (): Promise<LoadedSpec> => {
      const [result, undoHistory] = await Promise.all([
        loadPipelineByName(pipelineName),
        loadUndoHistory(pipelineName).catch(() => null),
      ]);

      if (!result.experiment?.componentRef?.spec) {
        throw new Error(`Pipeline "${pipelineName}" not found`);
      }

      if (undoHistory) {
        try {
          const replayIdGen = new ReplayIdGenerator(undoHistory.idStack);
          const spec = deserializeSpec(
            result.experiment.componentRef.spec,
            replayIdGen,
          );
          const restoredUndoStore = createUndoStoreWithEvents(
            undoHistory.undoEvents,
          );
          return { spec, restoredUndoStore };
        } catch (error) {
          console.warn("Failed to restore undo history, loading fresh:", error);
        }
      }

      return { spec: deserializeSpec(result.experiment.componentRef.spec) };
    },
    staleTime: Infinity,
    retry: false,
  });
}
