import type { ProjectSession } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { sessionLabelsById } from "@/services/projects/sessionLabel";
import type { ProjectSummary } from "@/services/projects/types";

export interface ProjectSearchMatch {
  project: ProjectSummary;
  matchingSessionIds: ReadonlySet<string>;
}

/**
 * Projects whose name holds the query, or with a session whose label does.
 * Sessions are matched by the label the sidebar shows, so an unnamed one is
 * found as "Session 2".
 */
export function searchProjects(
  projects: ProjectSummary[],
  sessionsByProject: ReadonlyMap<string, ProjectSession[]>,
  query: string,
): ProjectSearchMatch[] {
  const needle = query.trim().toLocaleLowerCase();
  const holdsNeedle = (text: string) =>
    text.toLocaleLowerCase().includes(needle);

  return projects.flatMap((project) => {
    const sessions = sessionsByProject.get(project.id) ?? [];
    const labels = sessionLabelsById(
      sessions.map((session) => [session.sessionId, session]),
    );
    const matchingSessionIds = new Set(
      [...labels].flatMap(([sessionId, label]) =>
        holdsNeedle(label) ? [sessionId] : [],
      ),
    );

    if (matchingSessionIds.size === 0 && !holdsNeedle(project.name)) return [];
    return [{ project, matchingSessionIds }];
  });
}
