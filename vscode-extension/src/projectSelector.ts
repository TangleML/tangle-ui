/**
 * The selector a project-scoped remote-env host mints its token with, matching
 * the `projectId:<id>` tag the web app puts on every session in the project.
 */
export function projectSelector(projectId: string): string {
  return `projectId:${projectId}`;
}
