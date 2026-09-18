import type { LocalPipelinePointer } from "@/services/localPipelines/types";
import type {
  CreateResourceInput,
  ProjectResourceSummary,
} from "@/services/projects/types";

const POINTER_KIND = "pipeline";
const BROWSER_STORAGE = "browser";
const EXTRA_DATA_LIMIT = 1024;

type PointerRow = Pick<
  ProjectResourceSummary,
  "entity" | "entityId" | "extraData"
>;

/**
 * Whether a row is *meant* to name a pipeline, which is a weaker question than
 * whether it still names one usefully. Anyone can write `extra_data`, so a row
 * can claim to be a pipeline and carry nothing resolvable — and it still must
 * not be offered for deletion as though it held the only copy of something.
 */
export const claimsLocalPipeline = (resource: PointerRow) =>
  resource.entity === "document" &&
  resource.entityId === null &&
  resource.extraData?.kind === POINTER_KIND;

/**
 * The resources API accepts only `pipeline | agent_session | document`, and a
 * `pipeline` must name a backend pipeline by uuid. A pipeline in this browser
 * has no such row, and inventing a uuid would leave something in a shared
 * table that every other client would read as a backend pipeline and fail to
 * fetch. So it is filed as the only thing it honestly is — a resource carrying
 * its own payload — and `extra_data` records what it points at.
 *
 * The pointer lives in `extra_data` rather than `payload` because the list
 * endpoint omits payloads, so a list that had to know what each row held would
 * cost one request per row. It also means `?entity=` cannot select these: any
 * filtering by kind has to happen here, on the client.
 */
export function pointerOf(
  resource: PointerRow,
): LocalPipelinePointer | undefined {
  if (!claimsLocalPipeline(resource)) {
    return undefined;
  }

  const localName = resource.extraData?.localName;
  if (typeof localName !== "string" || localName === "") {
    return undefined;
  }

  const localId = resource.extraData?.localId;
  return {
    localName,
    ...(typeof localId === "string" && localId !== ""
      ? { localId }
      : undefined),
  };
}

export class PointerTooLargeError extends Error {
  constructor(name: string) {
    super(`The name "${name}" is too long to record in a project.`);
    this.name = "PointerTooLargeError";
  }
}

export function localPipelineInput(
  pointer: LocalPipelinePointer,
): CreateResourceInput {
  const extraData = {
    kind: POINTER_KIND,
    storage: BROWSER_STORAGE,
    localName: pointer.localName,
    ...(pointer.localId ? { localId: pointer.localId } : undefined),
  };

  if (JSON.stringify(extraData).length > EXTRA_DATA_LIMIT) {
    throw new PointerTooLargeError(pointer.localName);
  }

  return {
    entity: "document",
    name: pointer.localName,
    payload: {},
    extraData,
  };
}

/**
 * What a resource should be filed under for a reader, as opposed to what the
 * API files it as: a pointer is a pipeline to everyone but the database. The
 * value stays inside the vocabulary the rest of the app orders and labels
 * resources by, so a pointer sorts and reads as the pipeline it names.
 */
export const resourceKind = (resource: PointerRow) =>
  claimsLocalPipeline(resource) ? POINTER_KIND : resource.entity;
