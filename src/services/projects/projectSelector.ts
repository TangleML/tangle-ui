const PROJECT_SELECTOR_PREFIX = "projectId";

/**
 * The selector tag a session carries so a selector-scoped remote-env host
 * minted with the same `projectId:<id>` serves every session in the project.
 */
export function projectSelector(projectId: string): string {
  return `${PROJECT_SELECTOR_PREFIX}:${projectId}`;
}
