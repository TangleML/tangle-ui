import {
  findById,
  findByStorageKey,
} from "@/services/pipelineStorage/pipelineRegistry";
import {
  getComponentFileFromList,
  getComponentFileNamesFromList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import type { LocalPipeline, LocalPipelinePointer } from "./types";
import { pointerKey } from "./types";

export async function listLocalPipelineNames(): Promise<string[]> {
  const names = await getComponentFileNamesFromList(USER_PIPELINES_LIST_NAME);
  return names.sort((left, right) => left.localeCompare(right));
}

/**
 * The id is tried before the name because a name can be recycled: rename a
 * pipeline, call the next one by the old name, and resolving by name finds the
 * wrong pipeline while looking perfectly successful. Registry ids are never
 * reused, so an id that still resolves names the pipeline that was added. The
 * name is the fallback, because most pipelines have no registry row at all.
 */
async function resolvePointer(
  pointer: LocalPipelinePointer,
  names: ReadonlySet<string>,
): Promise<string | undefined> {
  if (pointer.localId) {
    const registered = await findById(pointer.localId);
    if (registered && names.has(registered.storageKey)) {
      return registered.storageKey;
    }
  }

  return names.has(pointer.localName) ? pointer.localName : undefined;
}

export async function readLocalPipeline(
  pointer: LocalPipelinePointer,
): Promise<LocalPipeline | undefined> {
  const names = new Set(
    await getComponentFileNamesFromList(USER_PIPELINES_LIST_NAME),
  );
  const name = await resolvePointer(pointer, names);
  if (!name) {
    return undefined;
  }

  const entry = await getComponentFileFromList(USER_PIPELINES_LIST_NAME, name);
  if (!entry) {
    return undefined;
  }

  return {
    name,
    spec: entry.componentRef.spec,
    yaml: entry.componentRef.text,
    modifiedAt: entry.modificationTime,
  };
}

/**
 * Which of these pointers name a pipeline this browser still holds. Nothing is
 * deserialized, so a list of them costs one pass over the stored names plus a
 * key lookup each, rather than decoding every pipeline it asks about.
 */
export async function resolvePointers(
  pointers: readonly LocalPipelinePointer[],
): Promise<Record<string, string | null>> {
  const names = new Set(
    await getComponentFileNamesFromList(USER_PIPELINES_LIST_NAME),
  );
  const entries = await Promise.all(
    pointers.map(
      async (pointer) =>
        [
          pointerKey(pointer),
          (await resolvePointer(pointer, names)) ?? null,
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}

/**
 * The registry id is read, never created. Creating one would enter the pipeline
 * into the registry that the newer editor builds its folder listing from, so
 * adding a pipeline to a project would quietly change what another page shows.
 */
export async function pointerTo(
  pipelineName: string,
): Promise<LocalPipelinePointer> {
  const registered = await findByStorageKey(pipelineName);
  return {
    localName: pipelineName,
    ...(registered ? { localId: registered.id } : undefined),
  };
}
