import { tangentDb } from "./db";
import type { TangentProject } from "./types";

const MAX_DERIVED_NAME_LENGTH = 60;

/** Derives a readable project name from the first line of a prompt. */
export function deriveProjectName(prompt: string): string {
  const firstLine = prompt.trim().split("\n")[0]?.trim() ?? "";
  if (!firstLine) return "Untitled project";
  if (firstLine.length <= MAX_DERIVED_NAME_LENGTH) return firstLine;
  return `${firstLine.slice(0, MAX_DERIVED_NAME_LENGTH).trimEnd()}…`;
}

export async function createProject(name: string): Promise<TangentProject> {
  const now = Date.now();
  const project: TangentProject = {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled project",
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    memory: "",
  };
  await tangentDb.projects.add(project);
  return project;
}

export function listProjects(): Promise<TangentProject[]> {
  return tangentDb.projects.orderBy("lastActivityAt").reverse().toArray();
}

export function getProject(id: string): Promise<TangentProject | undefined> {
  return tangentDb.projects.get(id);
}

export async function renameProject(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await tangentDb.projects.update(id, {
    name: trimmed,
    updatedAt: Date.now(),
  });
}

export async function setActiveSession(
  id: string,
  sessionId: string,
): Promise<void> {
  const now = Date.now();
  await tangentDb.projects.update(id, {
    activeSessionId: sessionId,
    lastActivityAt: now,
    updatedAt: now,
  });
}

export async function deleteProject(id: string): Promise<void> {
  await tangentDb.transaction(
    "rw",
    tangentDb.projects,
    tangentDb.sessions,
    tangentDb.backlog,
    tangentDb.resources,
    async () => {
      await tangentDb.projects.delete(id);
      await tangentDb.sessions.where("projectId").equals(id).delete();
      await tangentDb.backlog.where("projectId").equals(id).delete();
      await tangentDb.resources.where("projectId").equals(id).delete();
    },
  );
}
