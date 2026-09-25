import { describe, expect, it } from "vitest";

import { projectRunAnnotationKey } from "@/utils/projectRunAnnotation";

import { sessionMemorySeed } from "./sessionMemory";

const PROJECT_ID = "project-1";

describe("sessionMemorySeed", () => {
  it("tells the agent to name the session, project and pipelines", () => {
    const seed = sessionMemorySeed(PROJECT_ID);

    expect(seed).toContain("name_session");
    expect(seed).toContain("rename_project");
    expect(seed).toContain("create_pipeline");
  });

  /** The human wrote them, so they are not buried under a housekeeping note. */
  it("puts the project's own instructions first", () => {
    const seed = sessionMemorySeed(PROJECT_ID, "Prefer concise plans.");

    expect(seed.startsWith("Prefer concise plans.")).toBe(true);
    expect(seed).toContain("name_session");
  });

  it("seeds the briefs alone when a project says nothing", () => {
    expect(sessionMemorySeed(PROJECT_ID, null)).toBe(
      sessionMemorySeed(PROJECT_ID, "   "),
    );
    expect(sessionMemorySeed(PROJECT_ID, undefined)).toBe(
      sessionMemorySeed(PROJECT_ID, null),
    );
  });

  it("does not leave the instructions running into the brief", () => {
    expect(sessionMemorySeed(PROJECT_ID, "Prefer concise plans.")).toContain(
      "Prefer concise plans.\n\n",
    );
  });

  /**
   * Nothing else tells a sandbox agent the id, and a run submitted without the
   * annotation cannot be attributed afterwards.
   */
  it("gives the agent the project id and the annotation to submit runs with", () => {
    const seed = sessionMemorySeed(PROJECT_ID);

    expect(seed).toContain(PROJECT_ID);
    expect(seed).toContain(`${projectRunAnnotationKey(PROJECT_ID)}: "true"`);
  });

  it("names both submit fields, since they differ per endpoint", () => {
    const seed = sessionMemorySeed(PROJECT_ID);

    expect(seed).toContain("`annotations`");
    expect(seed).toContain("`pipeline_run_annotations`");
  });

  /** Two projects on one submission is refused, and so is the key on a pipeline. */
  it("states the limits the backend enforces", () => {
    const seed = sessionMemorySeed(PROJECT_ID);

    expect(seed).toContain("Name one project per run");
    expect(seed).toContain("Never put this key on a pipeline you save");
    expect(seed).toContain("422");
  });

  it("builds the key from the shared helper rather than its own spelling", () => {
    expect(sessionMemorySeed("abc-123")).toContain(
      "tangleml.com/project/project-id/abc-123",
    );
  });
});
