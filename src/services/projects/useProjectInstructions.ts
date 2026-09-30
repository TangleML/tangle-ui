import {
  describeResource,
  INSTRUCTIONS,
  instructionsResourceInput,
} from "./resourceDescriptor";
import type { ProjectResourceSummary } from "./types";
import {
  useCreateProjectResource,
  useProjectResource,
  useProjectResources,
  useUpdateProjectResource,
} from "./useProjectResources";

const CONTENT_KEY = "content";

/**
 * A project carries one instructions document. The oldest wins if it somehow
 * holds two — they can only arrive from two clients writing at once, and
 * picking the oldest means every reader picks the same one.
 */
function findInstructions(
  resources: readonly ProjectResourceSummary[],
): ProjectResourceSummary | undefined {
  return [...resources]
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .find((resource) => describeResource(resource)?.type === INSTRUCTIONS);
}

interface ProjectInstructions {
  instructions: string;
  isPending: boolean;
  isSaving: boolean;
  save: (content: string) => void;
}

/**
 * The standing context agents are given for a project, read and written the
 * same way wherever it is edited.
 *
 * It takes two reads: the resource list says which row holds the instructions
 * but not what they say, because the list leaves payloads out. Both are already
 * fetched by anything showing a project, so in practice neither is a new
 * request.
 */
export function useProjectInstructions(projectId: string): ProjectInstructions {
  const { data: page, isPending: isListPending } = useProjectResources(
    projectId,
    { entity: ["document"] },
  );
  const row = findInstructions(page?.items ?? []);

  const { data: resource, isPending: isBodyPending } = useProjectResource(
    projectId,
    row?.id,
  );

  const { mutate: createResource, isPending: isCreating } =
    useCreateProjectResource(projectId);
  const { mutate: updateResource, isPending: isUpdating } =
    useUpdateProjectResource(projectId);

  const body = resource?.payload?.[CONTENT_KEY];

  return {
    instructions: typeof body === "string" ? body : "",
    isPending: isListPending || (row !== undefined && isBodyPending),
    isSaving: isCreating || isUpdating,
    save: (content: string) => {
      if (row) {
        updateResource({
          resourceId: row.id,
          input: { payload: { [CONTENT_KEY]: content } },
        });
        return;
      }
      createResource(instructionsResourceInput(content));
    },
  };
}
