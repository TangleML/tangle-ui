import type { ComponentSpec } from "@/utils/componentSpec";

import { pipelineStorageDb } from "./db";
import type { PipelineFile } from "./PipelineFile";

/**
 * A listing says what pipelines exist but not what is in them, and the pipeline
 * table searches inside them. Reading every pipeline on every visit is the cost
 * this avoids: a store that reports a `contentVersion` says which ones actually
 * changed, so the rest are answered from here.
 *
 * Nothing is ever served from this cache without the version the store just
 * reported agreeing, so it can go stale but cannot be believed when it has.
 */
function specCacheVersion(file: PipelineFile): string | undefined {
  return file.contentVersion ?? file.modifiedAt?.toISOString();
}

export async function readCachedSpecs(
  files: PipelineFile[],
): Promise<Map<string, ComponentSpec>> {
  const wanted = new Map(
    files.flatMap((file) => {
      const version = specCacheVersion(file);
      return version ? [[file.storageKey, version] as const] : [];
    }),
  );

  if (wanted.size === 0) return new Map();

  const cached = await pipelineStorageDb.pipeline_specs.bulkGet([
    ...wanted.keys(),
  ]);

  return new Map(
    cached.flatMap((entry) =>
      entry && entry.version === wanted.get(entry.storageKey)
        ? [[entry.storageKey, entry.spec] as const]
        : [],
    ),
  );
}

export async function writeCachedSpec(
  file: PipelineFile,
  spec: ComponentSpec,
): Promise<void> {
  const version = specCacheVersion(file);
  if (!version) return;

  await pipelineStorageDb.pipeline_specs.put({
    storageKey: file.storageKey,
    version,
    spec,
  });
}

export async function forgetUnlistedSpecs(
  listedKeys: Set<string>,
): Promise<void> {
  const stored = await pipelineStorageDb.pipeline_specs
    .toCollection()
    .primaryKeys();
  const gone = stored.filter((key) => !listedKeys.has(key));

  if (gone.length > 0) {
    await pipelineStorageDb.pipeline_specs.bulkDelete(gone);
  }
}
