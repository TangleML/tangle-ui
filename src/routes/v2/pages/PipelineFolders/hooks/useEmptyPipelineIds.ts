import { useQuery } from "@tanstack/react-query";
import yaml from "js-yaml";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";
import type { ComponentSpec } from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";

const NONE: ReadonlySet<string> = new Set();

export function pipelineTextHasNoTasks(text: string): boolean {
  let spec: ComponentSpec;
  try {
    spec = yaml.load(text) as ComponentSpec;
  } catch {
    return false;
  }

  if (!spec || typeof spec !== "object") return false;
  if (!isGraphImplementation(spec.implementation)) return false;

  const graph: unknown = spec.implementation.graph;
  if (!graph || typeof graph !== "object") return true;

  return Object.keys(spec.implementation.graph.tasks ?? {}).length === 0;
}

/**
 * An agent builds a pipeline by creating it empty and filling it in, so a
 * session abandoned before the filling-in leaves a pipeline that is real,
 * named and holds nothing. Until there is a draft state to put those in, a
 * picker has to tell them apart by reading them.
 */
export function useEmptyPipelineIds(
  pipelines: readonly PipelineFile[],
): ReadonlySet<string> {
  const ids = pipelines.map((pipeline) => pipeline.id).sort();

  const { data } = useQuery({
    queryKey: [...FoldersQueryKeys.All(), "empty", ids.join(",")],
    queryFn: async () => {
      const empty = await Promise.all(
        pipelines.map(async (pipeline) => {
          const text = await pipeline.read().catch(() => null);
          return text !== null && pipelineTextHasNoTasks(text)
            ? pipeline.id
            : null;
        }),
      );
      return new Set(empty.filter((id) => id !== null));
    },
    enabled: pipelines.length > 0,
  });

  return data ?? NONE;
}
