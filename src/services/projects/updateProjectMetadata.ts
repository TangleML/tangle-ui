import { getProject, updateProject } from "@/services/projects/projectsService";
import type { Project } from "@/services/projects/types";

type ProjectMetadata = Project["metadata"];

interface ProjectMetadataUpdate {
  project: Project;
  changed: boolean;
}

const lastWrite = new Map<string, Promise<unknown>>();

function afterEarlierWrites<T>(
  projectId: string,
  write: () => Promise<T>,
): Promise<T> {
  const queued = (lastWrite.get(projectId) ?? Promise.resolve()).then(
    write,
    write,
  );
  lastWrite.set(projectId, queued);
  const forget = () => {
    if (lastWrite.get(projectId) === queued) lastWrite.delete(projectId);
  };
  queued.then(forget, forget);
  return queued;
}

/**
 * Changes a project's metadata, with a new name alongside when one is given.
 * The PATCH replaces the whole metadata object, so the project is read again
 * just before and `change` is applied to that, and a project's changes are
 * saved one at a time: two that overlapped would each write back an object
 * without the other's key. Every writer of a project's metadata goes through
 * here for that reason.
 *
 * `change` returns nothing when what it reads means there's nothing to write.
 * `project` is then the one just read, and otherwise the one saved.
 */
export function updateProjectMetadata(
  projectId: string,
  change: (metadata: ProjectMetadata) => Record<string, unknown> | undefined,
  { name }: { name?: string } = {},
): Promise<ProjectMetadataUpdate> {
  return afterEarlierWrites(projectId, async () => {
    const latest = await getProject(projectId);
    const metadata = change(latest.metadata);
    if (metadata === undefined) return { project: latest, changed: false };
    const project = await updateProject(projectId, {
      ...(name === undefined ? {} : { name }),
      metadata,
    });
    return { project, changed: true };
  });
}
