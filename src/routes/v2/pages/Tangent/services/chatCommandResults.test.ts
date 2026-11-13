import { describe, expect, it } from "vitest";

import {
  assetsResult,
  filesResult,
  parsePipelineIds,
  pipelinesResult,
  type ProjectListing,
  RUN_LIMIT,
  runsResult,
  runStartsResult,
} from "./chatCommandResults";

const NOV_5 = new Date("2026-11-05T16:30:00");

function listing(overrides: Partial<ProjectListing> = {}): ProjectListing {
  return {
    runs: [],
    pipelines: [],
    documents: [],
    reports: [],
    runStatuses: new Map(),
    ...overrides,
  };
}

const links = {
  thisChat: "chat-1",
  fileUrl: ({ sessionId, path }: { sessionId: string; path: string }) =>
    `https://tangent.example/${sessionId}/${path}`,
};

function file(sessionId: string, path: string, pinned: boolean) {
  return { sessionId, path, title: path, addedAt: NOV_5, pinned };
}

describe("chat command results", () => {
  it("lists pipelines with the id /run takes, leaving archived ones out", () => {
    const text = pipelinesResult(
      listing({
        pipelines: [
          {
            target: "pipeline://remote/p-1",
            name: "Train [v2]",
            at: NOV_5,
            archived: false,
          },
          {
            target: "pipeline://id/f-2",
            name: "Old",
            at: null,
            archived: true,
          },
        ],
      }),
    );

    expect(text).toBe(
      [
        "**Pipelines** · 1",
        "",
        "- [Train \\[v2\\]](pipeline://remote/p-1) · id `p-1` · added Nov 5",
        "",
        "1 archived pipeline not listed.",
      ].join("\n"),
    );
    expect(pipelinesResult(listing())).toBe(
      "This project has no pipelines yet.",
    );
  });

  it("shows the newest runs with their status, saying how many are left out", () => {
    const runs = Array.from({ length: RUN_LIMIT + 2 }, (_, index) => ({
      target: `run://id/r-${index}`,
      name: `Run ${index}`,
      at: null,
      archived: false,
    }));

    const text = runsResult(
      listing({ runs, runStatuses: new Map([["run://id/r-0", "Succeeded"]]) }),
    );

    expect(text).toContain("- [Run 0](run://id/r-0) · Succeeded");
    expect(text).not.toContain(`Run ${RUN_LIMIT}]`);
    expect(text).toContain("…and 2 more.");
  });

  it("links this chat's files by path and other chats' by address", () => {
    const text = filesResult(
      [
        file("chat-1", "artifacts/report.html", true),
        file("chat-2", "artifacts/notes.md", false),
      ],
      links,
    );

    expect(text).toContain(
      "**Reports** · 1\n\n- [artifacts/report.html](artifacts/report.html)",
    );
    expect(text).toContain(
      "- [artifacts/notes.md](https://tangent.example/chat-2/artifacts/notes.md) · another chat",
    );
  });

  it("keeps a file whose path has a space readable as a link", () => {
    const text = filesResult(
      [file("chat-1", "artifacts/Final report (v2).html", true)],
      links,
    );

    expect(text).toContain(
      "- [artifacts/Final report (v2).html](<artifacts/Final report (v2).html>)",
    );
  });

  it("sums the project up a few at a time, pointing at the full lists", () => {
    const pipelines = Array.from({ length: 7 }, (_, index) => ({
      target: `pipeline://remote/p-${index}`,
      name: `Pipeline ${index}`,
      at: null,
      archived: false,
    }));

    const text = assetsResult(
      listing({ pipelines, reports: [file("chat-1", "artifacts/a.md", true)] }),
      links,
    );

    expect(text).toMatch(/^\*\*Reports\*\* · 1/);
    expect(text).toContain("…and 2 more. `/pipelines` lists them all.");
    expect(text).not.toContain("**Runs**");
    expect(assetsResult(listing(), links)).toBe(
      "This project doesn't have anything in it yet.",
    );
  });

  it("reads ids separated by commas or spaces, in brackets or not", () => {
    expect(parsePipelineIds("[p-1, p-2,p-1]  p-3")).toEqual([
      "p-1",
      "p-2",
      "p-3",
    ]);
    expect(parsePipelineIds("  ")).toEqual([]);
  });

  it("takes what was typed as one id when a pipeline is known by it", () => {
    const known = ["My pipeline", "p-1"];

    expect(parsePipelineIds(" [My pipeline] ", known)).toEqual(["My pipeline"]);
    expect(parsePipelineIds("My pipeline", [])).toEqual(["My", "pipeline"]);
    expect(parsePipelineIds("p-1, p-2", known)).toEqual(["p-1", "p-2"]);
  });

  it("reports the runs it started and the pipelines it couldn't start", () => {
    expect(
      runStartsResult([
        { id: "p-1", name: "Train", runTarget: "run://id/r-9" },
        { id: "nope", error: "not one of this project's pipelines" },
      ]),
    ).toBe(
      [
        "Started 1 run:",
        "",
        "- [Train](run://id/r-9)",
        "",
        "Couldn't start 1 pipeline:",
        "",
        "- `nope`: not one of this project's pipelines",
      ].join("\n"),
    );
  });
});
