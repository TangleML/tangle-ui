import {
  createProjectResource,
  listProjectResources,
} from "./projectResourcesService";
import { MAX_PAGE_SIZE } from "./queryDefaults";
import {
  describeResource,
  PIPELINE_RUN,
  pipelineRunResourceInput,
} from "./resourceDescriptor";
import { runTarget, sameTarget } from "./resourceTarget";

async function holdsPipelineRun(projectId: string, runId: string) {
  const run = runTarget(runId);
  let pageToken: string | undefined;

  do {
    const page = await listProjectResources(projectId, {
      entity: ["document"],
      pageSize: MAX_PAGE_SIZE,
      pageToken,
    });
    const held = page.items.some((resource) => {
      const described = describeResource(resource);
      return (
        described?.type === PIPELINE_RUN &&
        described.target !== undefined &&
        sameTarget(described.target, run)
      );
    });
    if (held) return true;
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken);

  return false;
}

export async function attachPipelineRunOnce(
  projectId: string,
  runId: string,
  pipelineName: string,
) {
  if (await holdsPipelineRun(projectId, runId)) return;
  await createProjectResource(
    projectId,
    pipelineRunResourceInput(runId, pipelineName),
  );
}
