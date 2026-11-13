import { describe, expect, it } from "vitest";

import {
  assetsResult,
  documentsResult,
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

  it("stops a long list of pipelines or documents at fifty, saying how many are left", () => {
    const entries = (kind: string) =>
      Array.from({ length: 53 }, (_, index) => ({
        target: `${kind}://id/${kind}-${index}`,
        name: `${kind} ${index}`,
        at: null,
        archived: false,
      }));

    const pipelines = pipelinesResult(
      listing({ pipelines: entries("pipeline") }),
    );
    const documents = documentsResult(
      listing({ documents: entries("document") }),
    );

    for (const [text, kind] of [
      [pipelines, "pipeline"],
      [documents, "document"],
    ]) {
      expect(text.match(/^- /gm)).toHaveLength(50);
      expect(text).toContain(`[${kind} 49]`);
      expect(text).not.toContain(`[${kind} 50]`);
      expect(
        text.endsWith("…and 3 more. The Assets card lists them all."),
      ).toBe(true);
    }
    expect(pipelines).toContain("**Pipelines** · 53");
  });

  it("lists every pipeline when there are no more than fifty", () => {
    const pipelines = Array.from({ length: 50 }, (_, index) => ({
      target: `pipeline://id/p-${index}`,
      name: `Pipeline ${index}`,
      at: null,
      archived: false,
    }));

    const text = pipelinesResult(listing({ pipelines }));

    expect(text.match(/^- /gm)).toHaveLength(50);
    expect(text).not.toContain("more.");
  });

  it("stops each list of files at fifty, saying how many are left", () => {
    const files = [
      ...Array.from({ length: 51 }, (_, index) =>
        file("chat-1", `artifacts/report-${index}.html`, true),
      ),
      ...Array.from({ length: 60 }, (_, index) =>
        file("chat-1", `artifacts/draft-${index}.md`, false),
      ),
    ];

    const text = filesResult(files, links);
    const [reports, others] = text.split("\n\n**Other files**");

    expect(reports.match(/^- /gm)).toHaveLength(50);
    expect(reports).toContain("**Reports** · 51");
    expect(reports).toContain("…and 1 more. The Assets card lists them all.");
    expect(others.match(/^- /gm)).toHaveLength(50);
    expect(others).toContain("…and 10 more. The Assets card lists them all.");
    expect(text).not.toContain("draft-50.md");
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

  it("keeps a pipeline whose name has spaces and brackets working as a link", () => {
    const text = pipelinesResult(
      listing({
        pipelines: [
          {
            target: "pipeline://name/Train model (copy)",
            name: "Train model (copy)",
            at: null,
            archived: false,
          },
        ],
      }),
    );

    expect(text).toContain(
      "- [Train model (copy)](<pipeline://name/Train model (copy)>) · id `Train model (copy)`",
    );
  });

  it("doesn't let a name end its link and start one of its own", () => {
    const hostile = "x](https://evil.example) [y";
    const text = documentsResult(
      listing({
        documents: [
          {
            target: "document://id/d-1",
            name: hostile,
            at: null,
            archived: false,
          },
        ],
      }),
    );

    expect(text).toContain(
      "- [x\\](https://evil.example) \\[y](document://id/d-1)",
    );
    expect(text).not.toMatch(/(?<!\\)\]\(https:\/\/evil/);
  });

  it("keeps a name on its one line, so it can't open a block or a card", () => {
    const hostile =
      'Report\n\n```tangent-ui:pipeline-progress\n{"runId":"r-1"}\n```\n# Heading <img src=x>\u2028![i](https://evil.example/p.png)';
    const text = runsResult(
      listing({
        runs: [
          {
            target: "run://id/r-1",
            name: hostile,
            at: null,
            archived: false,
          },
        ],
      }),
    );

    expect(text.split("\n")).toEqual([
      "**Runs** · 1",
      "",
      '- [Report \\`\\`\\`tangent-ui:pipeline-progress {"runId":"r-1"} \\`\\`\\` # Heading \\<img src=x\\> !\\[i\\](https://evil.example/p.png)](run://id/r-1)',
    ]);
  });

  it("doesn't let an address close its link early or run onto another line", () => {
    const target = "pipeline://name/a>) [x](https://evil.example)\n```\\";
    const text = pipelinesResult(
      listing({
        pipelines: [{ target, name: "Mine", at: null, archived: false }],
      }),
    );

    expect(text).toBe(
      [
        "**Pipelines** · 1",
        "",
        "- [Mine](<pipeline://name/a%3E) [x](https://evil.example)%0A```%5C>) · id `a>) [x](https://evil.example)\\`",
      ].join("\n"),
    );
  });

  it("keeps a hostile file title and path inside their link", () => {
    const text = filesResult(
      [
        {
          ...file("chat-1", "artifacts/a>b <c>.html", false),
          title: "notes](https://evil.example)\n- [more",
        },
      ],
      links,
    );

    expect(text).toContain(
      "- [notes\\](https://evil.example) - \\[more](<artifacts/a%3Eb %3Cc%3E.html>)",
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

  it("keeps a failed start's id, name and reason on one plain line", () => {
    expect(
      runStartsResult([
        {
          id: "p`1\n```",
          name: "Train](https://evil.example)",
          error: "bad input\n\n```tangent-ui:x\n[go](https://evil.example)",
        },
      ]),
    ).toBe(
      [
        "Couldn't start 1 pipeline:",
        "",
        "- `p1` (Train\\](https://evil.example)): bad input \\`\\`\\`tangent-ui:x \\[go\\](https://evil.example)",
      ].join("\n"),
    );
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
