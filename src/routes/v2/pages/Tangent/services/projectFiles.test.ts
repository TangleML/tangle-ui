import { describe, expect, it } from "vitest";

import { defaultPlacement, fileIcon } from "./projectFiles";

describe("defaultPlacement", () => {
  it.each([
    "artifacts/q3-summary.html",
    "artifacts/deck.PPTX",
    "artifacts/report.pdf",
    "artifacts/chart.png",
  ])("treats %s as a finished report", (path) => {
    expect(defaultPlacement(path)).toBe("report");
  });

  it.each([
    "artifacts/plan.md",
    "artifacts/history.txt",
    "artifacts/data.json",
    "artifacts/run.log",
    "artifacts/README",
  ])("tucks %s away as a working file", (path) => {
    expect(defaultPlacement(path)).toBe("working");
  });
});

describe("fileIcon", () => {
  it("picks an icon by kind of file", () => {
    expect(fileIcon("a/site/index.html")).toBe("Globe");
    expect(fileIcon("deck.key")).toBe("Presentation");
    expect(fileIcon("notes.md")).toBe("File");
  });
});
