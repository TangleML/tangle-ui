import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  forgetUnlistedSpecs,
  readCachedSpecs,
  writeCachedSpec,
} from "@/services/pipelineStorage/pipelineSpecCache";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { isRetriableStorageError } from "@/services/pipelineStorage/storageErrors";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";
import type { ComponentSpec } from "@/utils/componentSpec";
import { runWithConcurrency } from "@/utils/concurrency";
import { componentSpecFromYaml } from "@/utils/yaml";

const HYDRATION_CONCURRENCY = 3;

export interface PipelineListEntry {
  file: PipelineFile;
  spec?: ComponentSpec;
}

/**
 * The listing carries names and timestamps; searching by description, author or
 * component needs the pipeline itself. Rows are shown as soon as the listing
 * lands and the contents fill in behind them, a few at a time, so a store that
 * answers one pipeline per request is not asked for all of them at once.
 */
export function usePipelineListEntries() {
  const storage = usePipelineStorage();

  const {
    data: files,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: FoldersQueryKeys.AllPipelines(),
    queryFn: () => storage.listAllPipelines(),
    retry: isRetriableStorageError,
  });

  const [specs, setSpecs] = useState<ReadonlyMap<string, ComponentSpec>>(
    new Map(),
  );
  const [pendingCount, setPendingCount] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    if (!files) return;

    const generationAtStart = ++generation.current;
    const isStale = () => generation.current !== generationAtStart;

    void (async () => {
      const cached = await readCachedSpecs(files);
      if (isStale()) return;

      setSpecs(cached);
      void forgetUnlistedSpecs(new Set(files.map((file) => file.storageKey)));

      const missing = files.filter((file) => !cached.has(file.storageKey));
      setPendingCount(missing.length);

      await hydrate(missing, isStale, (file, spec) => {
        setSpecs((previous) => new Map(previous).set(file.storageKey, spec));
        setPendingCount((previous) => previous - 1);
      });

      if (!isStale()) setPendingCount(0);
    })();

    return () => {
      generation.current += 1;
    };
  }, [files]);

  const entries: PipelineListEntry[] = (files ?? []).map((file) => ({
    file,
    spec: specs.get(file.storageKey),
  }));

  return { entries, isLoading: isPending, error, pendingCount, refetch };
}

async function hydrate(
  files: PipelineFile[],
  isStale: () => boolean,
  onSpec: (file: PipelineFile, spec: ComponentSpec) => void,
): Promise<void> {
  await runWithConcurrency(files, HYDRATION_CONCURRENCY, async (file) => {
    if (isStale()) return;

    try {
      const spec = componentSpecFromYaml(await file.read());
      if (isStale()) return;

      onSpec(file, spec);
      void writeCachedSpec(file, spec);
    } catch (error) {
      console.error(`Failed to read pipeline "${file.displayName}":`, error);
    }
  });
}
