import { z } from "zod";

export const SAVED_PIPELINE_ID_ANNOTATION =
  "tangleml.com/user-pipeline/pipeline-id";
// Editor runs execute a snapshot, not necessarily the saved server definition.
export const SOURCE_PIPELINE_ID_ANNOTATION = "tangleml.com/source/pipeline-id";

const pipelineIdSchema = z.string().uuid();

export function isPipelineId(value: unknown): value is string {
  return pipelineIdSchema.safeParse(value).success;
}

export function getRunSourcePipelineId(
  annotations?: Record<string, string | null>,
): string | undefined {
  const id =
    annotations?.[SAVED_PIPELINE_ID_ANNOTATION] ??
    annotations?.[SOURCE_PIPELINE_ID_ANNOTATION];
  return isPipelineId(id) ? id : undefined;
}
