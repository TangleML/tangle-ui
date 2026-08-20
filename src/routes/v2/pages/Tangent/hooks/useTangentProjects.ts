import { useLiveQuery } from "dexie-react-hooks";

import { tangentDb } from "@/services/tangentStorage/db";
import type { TangentProject } from "@/services/tangentStorage/types";

export interface TangentProjectSummary extends TangentProject {
  sessionCount: number;
}

export function useTangentProjects(): TangentProjectSummary[] | undefined {
  return useLiveQuery(async () => {
    const projects = await tangentDb.projects
      .orderBy("lastActivityAt")
      .reverse()
      .toArray();

    return Promise.all(
      projects.map(async (project) => ({
        ...project,
        sessionCount: await tangentDb.sessions
          .where("projectId")
          .equals(project.id)
          .count(),
      })),
    );
  }, []);
}
