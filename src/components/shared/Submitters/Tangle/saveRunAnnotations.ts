import { updateRunAnnotation } from "@/services/pipelineRunService";
import {
  getPipelineTagsFromSpec,
  PIPELINE_RUN_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
} from "@/utils/annotations";
import type { ComponentSpec } from "@/utils/componentSpec";

interface RunAnnotationsFromSubmission {
  notes?: string;
  componentSpec?: ComponentSpec;
}

/**
 * The notes a run was submitted with, and the tags its pipeline carries, are
 * copied onto the run once it exists — they cannot travel in the submission
 * itself. Both keys are written one at a time through the endpoint that takes
 * the key as a path segment, which is why a project cannot be recorded this
 * way: its key holds slashes.
 */
export async function saveRunAnnotations(
  runId: string,
  backendUrl: string,
  { notes, componentSpec }: RunAnnotationsFromSubmission,
) {
  const writes: { key: string; value: string }[] = [];

  if (notes !== undefined && notes.trim() !== "") {
    writes.push({ key: PIPELINE_RUN_NOTES_ANNOTATION, value: notes });
  }

  const tags = getPipelineTagsFromSpec(componentSpec);
  if (tags.length > 0) {
    writes.push({ key: PIPELINE_TAGS_ANNOTATION, value: tags.join(",") });
  }

  // Neither annotation depends on the other, so one being refused must not take
  // the other down with it.
  const settled = await Promise.allSettled(
    writes.map((write) => updateRunAnnotation(runId, backendUrl, write)),
  );

  const failed = settled.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    throw failed[0].reason;
  }
}
