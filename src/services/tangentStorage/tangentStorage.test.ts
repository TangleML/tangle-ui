import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { tangentDb } from "./db";
import {
  createProject,
  deleteProject,
  deriveProjectName,
  getProject,
  listProjects,
  renameProject,
  setActiveSession,
} from "./projects";
import { addSession, listProjectSessions } from "./sessions";

afterEach(async () => {
  await tangentDb.projects.clear();
  await tangentDb.sessions.clear();
  await tangentDb.backlog.clear();
});

describe("deriveProjectName", () => {
  it("uses the first line of the prompt", () => {
    expect(deriveProjectName("Build a churn model\nwith XGBoost")).toBe(
      "Build a churn model",
    );
  });

  it("falls back for empty prompts", () => {
    expect(deriveProjectName("   ")).toBe("Untitled project");
  });

  it("truncates long single-line prompts", () => {
    const name = deriveProjectName("x".repeat(200));
    expect(name.endsWith("…")).toBe(true);
    expect(name.length).toBeLessThanOrEqual(61);
  });
});

describe("project storage", () => {
  it("creates and lists projects newest-active first", async () => {
    const first = await createProject("First");
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await createProject("Second");

    const projects = await listProjects();
    expect(projects.map((p) => p.id)).toEqual([second.id, first.id]);
    expect(projects[0].status).toBe("active");
  });

  it("renames a project", async () => {
    const project = await createProject("Old name");
    await renameProject(project.id, "New name");

    const updated = await getProject(project.id);
    expect(updated?.name).toBe("New name");
  });

  it("links a session and marks it active", async () => {
    const project = await createProject("With session");
    await addSession({
      sessionId: "session-1",
      projectId: project.id,
      openingPrompt: "hi",
    });
    await setActiveSession(project.id, "session-1");

    const sessions = await listProjectSessions(project.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("session-1");

    const updated = await getProject(project.id);
    expect(updated?.activeSessionId).toBe("session-1");
  });

  it("cascades session deletion when a project is removed", async () => {
    const project = await createProject("Doomed");
    await addSession({ sessionId: "session-x", projectId: project.id });

    await deleteProject(project.id);

    expect(await getProject(project.id)).toBeUndefined();
    expect(await listProjectSessions(project.id)).toHaveLength(0);
  });
});
