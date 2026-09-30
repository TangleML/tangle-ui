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
  if (notes !== undefined && notes.trim() !== "") {
    await updateRunAnnotation(runId, backendUrl, {
      key: PIPELINE_RUN_NOTES_ANNOTATION,
      value: notes,
    });
  }

  const tags = getPipelineTagsFromSpec(componentSpec);
  if (tags.length > 0) {
    await updateRunAnnotation(runId, backendUrl, {
      key: PIPELINE_TAGS_ANNOTATION,
      value: tags.join(","),
    });
  }
}
