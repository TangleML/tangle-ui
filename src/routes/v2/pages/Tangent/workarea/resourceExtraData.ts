import type { WorkareaTargetString } from "./types";
import {
  formatWorkareaTarget,
  idIdentity,
  isWorkareaTargetString,
  nameIdentity,
} from "./workareaTarget";

export interface ResourceExtraData {
  type: string;
  identity?: WorkareaTargetString;
  url?: string;
}

export function parseResourceExtraData(
  extraData: Record<string, unknown> | null,
): ResourceExtraData | null {
  if (!extraData) return null;
  const { type, identity, url } = extraData;
  if (typeof type !== "string") return null;
  return {
    type,
    identity:
      typeof identity === "string" && isWorkareaTargetString(identity)
        ? identity
        : undefined,
    url: typeof url === "string" ? url : undefined,
  };
}

export function localPipelineResourceExtraData(
  fileId: string,
): Record<string, unknown> {
  return {
    type: "local_pipeline",
    identity: formatWorkareaTarget({
      type: "pipeline",
      identity: idIdentity(fileId),
    }),
  };
}

export function localPipelineByNameResourceExtraData(
  name: string,
): Record<string, unknown> {
  return {
    type: "local_pipeline",
    identity: formatWorkareaTarget({
      type: "pipeline",
      identity: nameIdentity(name),
    }),
  };
}

export function pipelineRunResourceExtraData(
  runId: string,
  url: string,
): Record<string, unknown> {
  return {
    type: "pipeline_run",
    identity: formatWorkareaTarget({
      type: "run",
      identity: idIdentity(runId),
    }),
    url,
  };
}
