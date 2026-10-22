import type { WorkareaTarget } from "./resourceTarget";
import {
  formatWorkareaTarget,
  isWorkareaTargetString,
  parseWorkareaTarget,
  runTarget,
} from "./resourceTarget";
import type { CreateResourceInput, ProjectResourceSummary } from "./types";

export const PIPELINE_RUN = "pipeline_run";
export const DOCUMENT = "document";
export const INSTRUCTIONS = "instructions";
export const AGENT_SESSION = "agent_session";

type ResourceRow = Pick<ProjectResourceSummary, "metadata">;

export interface ResourceDescriptor {
  type: string;
  target?: WorkareaTarget;
}

/**
 * `type` and `target` are separate axes: two row kinds can share a view kind,
 * and a row kind can have no view at all.
 *
 * An unrecognised `type` is returned as-is rather than rejected, because `data`
 * is free-form and anyone may PATCH it — a row this build does not know about
 * still has to render as something.
 */
export function describeResource(
  resource: ResourceRow,
): ResourceDescriptor | undefined {
  const metadata = resource.metadata;
  if (!metadata) return undefined;

  const { type, identity } = metadata;
  if (typeof type !== "string" || type === "") return undefined;

  return {
    type,
    ...(typeof identity === "string" && isWorkareaTargetString(identity)
      ? { target: parseWorkareaTarget(identity) }
      : undefined),
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
    metadata: { type: DOCUMENT },
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
    metadata: { type: INSTRUCTIONS },
  };
}

export function pipelineRunResourceInput(
  runId: string,
  name: string,
): CreateResourceInput {
  return {
    entity: "document",
    name,
    payload: {},
    metadata: {
      type: PIPELINE_RUN,
      identity: formatWorkareaTarget(runTarget(runId)),
    },
  };
}
