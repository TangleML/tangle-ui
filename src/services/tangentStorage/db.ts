import { Dexie, type EntityTable } from "dexie";

import type {
  TangentBacklogItem,
  TangentProject,
  TangentResource,
  TangentSession,
} from "./types";

export const tangentDb = new Dexie("tangent") as Dexie & {
  projects: EntityTable<TangentProject, "id">;
  sessions: EntityTable<TangentSession, "id">;
  backlog: EntityTable<TangentBacklogItem, "id">;
  resources: EntityTable<TangentResource, "id">;
};

tangentDb.version(1).stores({
  projects: "id, lastActivityAt, status",
  sessions: "id, projectId, createdAt",
  backlog: "id, projectId, [projectId+order]",
});

tangentDb.version(2).stores({
  projects: "id, lastActivityAt, status",
  sessions: "id, projectId, createdAt",
  backlog: "id, projectId, [projectId+order]",
  resources: "id, projectId, [projectId+url]",
});
