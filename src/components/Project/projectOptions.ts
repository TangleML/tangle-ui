import type { PipelineProjectMembership } from "@/services/projects/usePipelineProjects";

export const NO_PROJECT = "none";

export interface ProjectOption {
  id: string;
  name: string;
}

/**
 * A project can be selected without holding the pipeline — the id arrives in
 * the URL and membership is never checked — so it is listed whether or not it
 * is a member, or the control would read as though nothing were chosen.
 */
export function projectOptions(
  memberships: readonly PipelineProjectMembership[],
  selectedId: string | undefined,
  selectedName: string | undefined,
): ProjectOption[] {
  const options = memberships.map(({ project }) => ({
    id: project.id,
    name: project.name,
  }));

  if (selectedId && !options.some((option) => option.id === selectedId)) {
    options.unshift({
      id: selectedId,
      name: selectedName ?? "Current project",
    });
  }

  return options;
}
