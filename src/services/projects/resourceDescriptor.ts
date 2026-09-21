import type { LocalPipelinePointer } from "@/services/localPipelines/types";

import type { WorkareaTarget } from "./resourceTarget";
import {
  formatWorkareaTarget,
  idIdentity,
  isWorkareaTargetString,
  nameIdentity,
  parseWorkareaTarget,
} from "./resourceTarget";
import type { CreateResourceInput, ProjectResourceSummary } from "./types";

export const LOCAL_PIPELINE = "local_pipeline";
export const PIPELINE_RUN = "pipeline_run";

const BROWSER = "browser";

const EXTRA_DATA_LIMIT = 1024;

type ResourceRow = Pick<ProjectResourceSummary, "extraData">;

export interface ResourceDescriptor {
  type: string;
  storage?: string;
  target?: WorkareaTarget;
  fallbackName?: string;
  url?: string;
}

export class DescriptorTooLargeError extends Error {
  constructor(name: string) {
    super(`The name "${name}" is too long to record in a project.`);
    this.name = "DescriptorTooLargeError";
  }
}

/**
 * What a resource row says it is, in the one vocabulary both pages read.
 *
 * `type` is the row kind, which is what a badge says and what a list filters
 * on. `target` is where the row points, in the grammar the Tangent workarea
 * dispatches views from. They are separate axes: two row kinds can share a view
 * kind, and a row kind can have no view at all.
 *
 * An unrecognised `type` is returned as-is rather than rejected. The backend
 * stores `extra_data` free-form and anyone may PATCH it, so a row this build
 * does not know about still has to render as something.
 */
export function describeResource(
  resource: ResourceRow,
): ResourceDescriptor | undefined {
  const extraData = resource.extraData;
  if (!extraData) return undefined;

  const { type, identity, storage, fallbackName, url } = extraData;
  if (typeof type !== "string" || type === "") return undefined;

  return {
    type,
    ...(typeof storage === "string" ? { storage } : undefined),
    ...(typeof identity === "string" && isWorkareaTargetString(identity)
      ? { target: parseWorkareaTarget(identity) }
      : undefined),
    ...(typeof fallbackName === "string" && fallbackName !== ""
      ? { fallbackName }
      : undefined),
    ...(typeof url === "string" ? { url } : undefined),
  };
}

export const namesLocalPipeline = (resource: ResourceRow): boolean =>
  describeResource(resource)?.type === LOCAL_PIPELINE;

/**
 * How to find a browser-held pipeline again. The id is tried first because a
 * name can be recycled, and the name is the fallback because most pipelines in
 * a browser have no registry row to be addressed by.
 *
 * The name comes from `fallbackName` rather than the row's `name`, which is a
 * label anyone may PATCH: this records what the pipeline was called when it was
 * attached, which is what makes it findable after the label has moved on.
 */
export function localPipelinePointerOf(
  resource: ResourceRow,
): LocalPipelinePointer | undefined {
  const descriptor = describeResource(resource);
  if (descriptor?.type !== LOCAL_PIPELINE) return undefined;

  const target = descriptor.target;
  if (target?.type !== "pipeline") return undefined;

  const [key, value] = splitIdentity(target.identity);
  const localName = key === "name" ? value : (descriptor.fallbackName ?? "");
  const localId = key === "id" ? value : undefined;

  if (localName === "" && localId === undefined) return undefined;

  return { localName, ...(localId ? { localId } : undefined) };
}

function splitIdentity(identity: string): [string, string] {
  const slash = identity.indexOf("/");
  return [identity.slice(0, slash), identity.slice(slash + 1)];
}

function withinLimit(
  extraData: Record<string, unknown>,
  name: string,
): Record<string, unknown> {
  if (JSON.stringify(extraData).length > EXTRA_DATA_LIMIT) {
    throw new DescriptorTooLargeError(name);
  }
  return extraData;
}

/**
 * A browser-held pipeline is filed as the only thing it honestly is — a
 * resource carrying its own payload — because the resources API accepts only
 * `pipeline | agent_session | document` and a `pipeline` must name a backend
 * pipeline by uuid. Inventing one would leave a row in a shared table that
 * every other client reads as a backend pipeline and fails to fetch.
 *
 * The descriptor lives in `extra_data` rather than `payload` because the list
 * endpoint omits payloads, so a list that had to know what each row held would
 * cost one request per row. It also means `?entity=` cannot select these: any
 * filtering by kind happens on the client.
 */
export function localPipelineResourceInput(
  pointer: LocalPipelinePointer,
): CreateResourceInput {
  const identity = pointer.localId
    ? idIdentity(pointer.localId)
    : nameIdentity(pointer.localName);

  return {
    entity: "document",
    name: pointer.localName,
    payload: {},
    extraData: withinLimit(
      {
        type: LOCAL_PIPELINE,
        storage: BROWSER,
        identity: formatWorkareaTarget({ type: "pipeline", identity }),
        fallbackName: pointer.localName,
      },
      pointer.localName,
    ),
  };
}

export function pipelineRunResourceInput(
  runId: string,
  url: string,
  name: string,
): CreateResourceInput {
  return {
    entity: "document",
    name,
    payload: {},
    extraData: {
      type: PIPELINE_RUN,
      identity: formatWorkareaTarget({
        type: "run",
        identity: idIdentity(runId),
      }),
      url,
    },
  };
}
