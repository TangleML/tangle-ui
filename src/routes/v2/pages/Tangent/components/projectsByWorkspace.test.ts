import { describe, expect, it } from "vitest";

import type { ProjectSummary, Workspace } from "@/services/projects/types";

import { groupProjectsByWorkspace } from "./projectsByWorkspace";

const project = (id: string, workspaceId: string) =>
  ({ id, name: id, workspaceId }) as ProjectSummary;
const workspace = (id: string, name: string) => ({ id, name }) as Workspace;

function titlesAndIds(sections: ReturnType<typeof groupProjectsByWorkspace>) {
  return sections.map(({ title, projects }) => [
    title,
    projects.map(({ id }) => id),
  ]);
}

describe("groupProjectsByWorkspace", () => {
  it("gathers each workspace's projects in their order, with workspaces by name", () => {
    const sections = groupProjectsByWorkspace(
      [project("a", "ws-2"), project("b", "ws-1"), project("c", "ws-2")],
      [
        workspace("ws-1", "Research"),
        workspace("ws-2", "analytics"),
        workspace("ws-3", "Empty"),
      ],
    );

    expect(titlesAndIds(sections)).toEqual([
      ["analytics", ["a", "c"]],
      ["Research", ["b"]],
    ]);
  });

  it("keeps the projects of workspaces it does not know last, together under one title", () => {
    const sections = groupProjectsByWorkspace(
      [project("a", "ws-gone"), project("b", "ws-1"), project("c", "ws-lost")],
      [workspace("ws-1", "Zebra")],
    );

    expect(titlesAndIds(sections)).toEqual([
      ["Zebra", ["b"]],
      ["Other workspace", ["a", "c"]],
    ]);
  });
});
