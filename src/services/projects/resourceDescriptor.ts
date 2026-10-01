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
export const DOCUMENT = "document";
export const INSTRUCTIONS = "instructions";
export const AGENT_SESSION = "agent_session";

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
 * `type` and `target` are separate axes: two row kinds can share a view kind,
 * and a row kind can have no view at all.
 *
 * An unrecognised `type` is returned as-is rather than rejected, because
 * `extra_data` is free-form and anyone may PATCH it — a row this build does not
 * know about still has to render as something.
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
 * The id is tried first because a name can be recycled; the name is the
 * fallback because most pipelines in a browser have no registry row.
 *
 * That name comes from `fallbackName`, not the row's `name`: the row's label is
 * PATCHable, while `fallbackName` records what the pipeline was called when it
 * was attached, which is what still finds it after the label has moved on.
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
 * Filed as `document` rather than `pipeline`: the API accepts only
 * `pipeline | agent_session | document`, and a `pipeline` must name a backend
 * pipeline by uuid. Inventing one would leave a row every other client reads
 * as a backend pipeline and fails to fetch.
 *
 * The descriptor goes in `extra_data`, not `payload`, because the list endpoint
 * omits payloads. The cost is that `?entity=` cannot select these, so filtering
 * by kind happens on the client.
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

/** No identity to record: the row is the document. */
export function documentResourceInput(
  title: string,
  content: string,
): CreateResourceInput {
  return {
    entity: "document",
    name: title,
    // The backend validates nothing inside a document payload; `content` is
    // this app's convention for the whole body.
    payload: { content },
    extraData: { type: DOCUMENT },
  };
}

const INSTRUCTIONS_NAME = "Instructions";

/**
 * Standing context for the agents working on a project. Filed as a document
 * rather than a field on the project so that listing, preview and read-back
 * come from the code that already handles documents.
 */
export function instructionsResourceInput(
  content: string,
): CreateResourceInput {
  return {
    entity: "document",
    name: INSTRUCTIONS_NAME,
    payload: { content },
    extraData: { type: INSTRUCTIONS },
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
