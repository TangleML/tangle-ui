import { useQuery } from "@tanstack/react-query";
import yaml from "js-yaml";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";
import { isRecord } from "@/utils/typeGuards";

const NONE: ReadonlySet<string> = new Set();

/**
 * Every step is checked against the parsed yaml rather than a spec type,
 * because this reads whatever is in storage: a scalar where an object belongs
 * made the domain guard throw, and one such pipeline took the whole folder's
 * reads down with it. Anything unreadable is not empty, so it stays listed.
 */
export function pipelineTextHasNoTasks(text: string): boolean {
  let parsed: unknown;
  try {
    parsed = yaml.load(text);
  } catch {
    return false;
  }

  if (!isRecord(parsed)) return false;

  const implementation = parsed.implementation;
  if (!isRecord(implementation) || !("graph" in implementation)) return false;

  const graph = implementation.graph;
  if (!isRecord(graph)) return true;

  const tasks = graph.tasks;
  if (tasks === undefined || tasks === null) return true;

  return isRecord(tasks) && Object.keys(tasks).length === 0;
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
