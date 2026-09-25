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

const NAME_LENGTH_LIMIT = 120;
const SUFFIX_ATTEMPTS = 100;

/**
 * A name nothing is stored under yet, so writing it cannot overwrite anything.
 *
 * `PipelineFolder.addFile` asks the *registry* whether a name is free, while
 * the driver it writes through keys off the stored-file list, which also holds
 * pipelines that never got a registry row. A name that passes that check can
 * therefore still land on top of one of those, so the list is what gets asked
 * here. The length cap keeps a derived name short enough to record in a
 * project's `extra_data`.
 */
export async function availablePipelineName(base: string): Promise<string> {
  const trimmed = base.trim().slice(0, NAME_LENGTH_LIMIT).trim();
  const taken = new Set(await listLocalPipelineNames());
  if (!taken.has(trimmed)) return trimmed;

  for (let ordinal = 2; ordinal <= SUFFIX_ATTEMPTS; ordinal++) {
    const candidate = `${trimmed} ${ordinal}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${trimmed} ${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * A recorded id is the whole answer, because a name can be recycled: rename a
 * pipeline, call the next one by the old name, and resolving by name finds the
 * wrong pipeline while looking perfectly successful. Registry ids are never
 * reused, so an id that still resolves names the pipeline that was added — and
 * an id that does not resolve means the pipeline is not here, which falling
 * back to the name would paper over with whatever happens to share it. That
 * matters across browsers: projects are shared, so a pointer routinely arrives
 * at a browser holding an unrelated pipeline of the same name.
 *
 * Only a pointer that recorded no id at all is resolved by name, because for
 * those the name is the only handle there has ever been.
 */
async function resolvePointer(
  pointer: LocalPipelinePointer,
  names: ReadonlySet<string>,
): Promise<string | undefined> {
  if (pointer.localId) {
    const registered = await findById(pointer.localId);
    return registered && names.has(registered.storageKey)
      ? registered.storageKey
      : undefined;
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
