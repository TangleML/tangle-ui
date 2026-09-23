import { describe, expect, it } from "vitest";

import { sessionMemorySeed } from "./sessionMemory";

describe("sessionMemorySeed", () => {
  it("tells the agent to name the session, project and pipelines", () => {
    const seed = sessionMemorySeed(null);

    expect(seed).toContain("name_session");
    expect(seed).toContain("rename_project");
    expect(seed).toContain("create_pipeline");
  });

  /** The human wrote them, so they are not buried under a housekeeping note. */
  it("puts the project's own instructions first", () => {
    const seed = sessionMemorySeed("Prefer concise plans.");

    expect(seed.startsWith("Prefer concise plans.")).toBe(true);
    expect(seed).toContain("name_session");
  });

  it("seeds the naming brief alone when a project says nothing", () => {
    expect(sessionMemorySeed(null)).toBe(sessionMemorySeed("   "));
    expect(sessionMemorySeed(undefined)).toBe(sessionMemorySeed(null));
  });

  it("does not leave the instructions running into the brief", () => {
    expect(sessionMemorySeed("Prefer concise plans.")).toContain(
      "Prefer concise plans.\n\n",
    );
  });
});
