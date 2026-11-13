import { describe, expect, it, vi } from "vitest";

import {
  createProjectCardRemoteTools,
  type ProjectCardToolDeps,
} from "./createProjectCardRemoteTools";

function makeDeps(
  overrides: Partial<ProjectCardToolDeps> = {},
): ProjectCardToolDeps {
  return {
    getActiveSessionId: () => "chat-1",
    listEntries: vi
      .fn()
      .mockResolvedValue({ runs: [], pipelines: [], documents: [] }),
    listArchived: vi.fn().mockResolvedValue([]),
    setArchived: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
    pinFile: vi.fn().mockResolvedValue(undefined),
    unpinFile: vi.fn().mockResolvedValue(undefined),
    listChatRuns: vi.fn().mockResolvedValue([]),
    dismissChatRun: vi.fn().mockResolvedValue(true),
    addRun: vi.fn().mockResolvedValue({ added: true, target: "run://id/r-1" }),
    addDocument: vi.fn().mockResolvedValue("document://id/d-9"),
    ...overrides,
  };
}

function toolsWith(deps: ProjectCardToolDeps) {
  return createProjectCardRemoteTools(() => deps);
}

function listed(sessionId: string, path: string, pinned = false) {
  return {
    sessionId,
    path,
    title: path,
    addedAt: new Date("2026-11-06T08:00:00Z"),
    pinned,
  };
}

describe("createProjectCardRemoteTools", () => {
  it("lists the card's items, saying which are archived", async () => {
    const tools = toolsWith(
      makeDeps({
        listEntries: vi.fn().mockResolvedValue({
          runs: [
            {
              target: "run://id/r-1",
              name: "Train",
              at: new Date("2026-11-05T10:00:00Z"),
            },
          ],
          pipelines: [
            { target: "pipeline://remote/p-1", name: "Train", at: null },
          ],
          documents: [
            {
              target: "document://id/d-1",
              name: "Brief",
              at: new Date("2026-11-01T09:00:00Z"),
            },
          ],
        }),
        listArchived: vi.fn().mockResolvedValue(["document://id/d-1"]),
      }),
    );

    expect(await tools.list_project_items.execute({})).toEqual({
      runs: [
        {
          target: "run://id/r-1",
          name: "Train",
          ranAt: "2026-11-05T10:00:00.000Z",
          archived: false,
        },
      ],
      pipelines: [
        {
          target: "pipeline://remote/p-1",
          name: "Train",
          addedAt: null,
          archived: false,
        },
      ],
      documents: [
        {
          target: "document://id/d-1",
          name: "Brief",
          addedAt: "2026-11-01T09:00:00.000Z",
          archived: true,
        },
      ],
    });
  });

  it("archives and restores by the target the card keys on", async () => {
    const deps = makeDeps({
      listEntries: vi.fn().mockResolvedValue({
        runs: [{ target: "run://id/r-7", name: "Train", at: null }],
        pipelines: [],
        documents: [],
      }),
      listArchived: vi.fn().mockResolvedValue(["document://id/d-1"]),
    });
    const tools = toolsWith(deps);

    await tools.archive_project_item.execute({
      target: "https://other.example/runs/r-7",
    });
    await tools.restore_project_item.execute({ target: "document://id/d-1" });

    expect(deps.setArchived).toHaveBeenNthCalledWith(1, "run://id/r-7", true);
    expect(deps.setArchived).toHaveBeenNthCalledWith(
      2,
      "document://id/d-1",
      false,
    );
  });

  it("only archives runs, pipelines and documents", async () => {
    const deps = makeDeps();
    const tools = toolsWith(deps);

    await expect(
      tools.archive_project_item.execute({
        target: "artifact://id/https://files.example/a.html",
      }),
    ).rejects.toThrow(/run, pipeline or document/);
    expect(deps.setArchived).not.toHaveBeenCalled();
  });

  it("won't archive something that isn't on the card", async () => {
    const deps = makeDeps();
    const tools = toolsWith(deps);

    await expect(
      tools.archive_project_item.execute({ target: "pipeline://name/Train" }),
    ).rejects.toThrow(/isn't on the project card/);
    expect(deps.setArchived).not.toHaveBeenCalled();
  });

  it("won't restore something that isn't archived", async () => {
    const deps = makeDeps();
    const tools = toolsWith(deps);

    await expect(
      tools.restore_project_item.execute({ target: "run://id/r-7" }),
    ).rejects.toThrow(/isn't archived/);
    expect(deps.setArchived).not.toHaveBeenCalled();
  });

  it("lists every chat's files, marking the ones in this chat", async () => {
    const addedAt = new Date("2026-11-06T08:00:00Z");
    const tools = toolsWith(
      makeDeps({
        listFiles: vi.fn().mockResolvedValue([
          {
            sessionId: "chat-1",
            path: "artifacts/report.html",
            title: "Report",
            addedAt,
            pinned: true,
          },
          {
            sessionId: "chat-2",
            path: "artifacts/notes.md",
            title: "artifacts/notes.md",
            addedAt,
            pinned: false,
          },
        ]),
      }),
    );

    const result = await tools.list_project_files.execute({});

    expect(result).toEqual({
      files: [
        expect.objectContaining({ sessionId: "chat-1", inThisChat: true }),
        expect.objectContaining({
          sessionId: "chat-2",
          pinned: false,
          addedAt: "2026-11-06T08:00:00.000Z",
          inThisChat: false,
        }),
      ],
    });
  });

  it("pins in this chat by default, titled by its path", async () => {
    const deps = makeDeps({
      listFiles: vi
        .fn()
        .mockResolvedValue([
          listed("chat-1", "artifacts/report.html"),
          listed("chat-2", "artifacts/deck.html"),
        ]),
    });
    const tools = toolsWith(deps);

    await tools.pin_project_file.execute({ path: "artifacts/report.html" });
    await tools.pin_project_file.execute({
      path: "artifacts/deck.html",
      sessionId: "chat-2",
      title: "Deck",
    });

    expect(deps.pinFile).toHaveBeenNthCalledWith(
      1,
      "chat-1",
      "artifacts/report.html",
      "artifacts/report.html",
    );
    expect(deps.pinFile).toHaveBeenNthCalledWith(
      2,
      "chat-2",
      "artifacts/deck.html",
      "Deck",
    );
  });

  it("unpins a file in the chat it names", async () => {
    const deps = makeDeps({
      listFiles: vi
        .fn()
        .mockResolvedValue([listed("chat-2", "artifacts/notes.md", true)]),
    });
    const tools = toolsWith(deps);

    await tools.unpin_project_file.execute({
      path: "artifacts/notes.md",
      sessionId: "chat-2",
    });

    expect(deps.unpinFile).toHaveBeenCalledWith("chat-2", "artifacts/notes.md");
    await expect(tools.unpin_project_file.execute({})).rejects.toThrow(/path/);
  });

  it("won't pin or unpin a file the card doesn't list, such as one in another project's chat", async () => {
    const deps = makeDeps({
      listFiles: vi
        .fn()
        .mockResolvedValue([listed("chat-1", "artifacts/report.html")]),
    });
    const tools = toolsWith(deps);

    await expect(
      tools.pin_project_file.execute({
        path: "artifacts/report.html",
        sessionId: "other-project-chat",
      }),
    ).rejects.toThrow(/No file `artifacts\/report.html` in that chat/);
    await expect(
      tools.unpin_project_file.execute({ path: "artifacts/missing.html" }),
    ).rejects.toThrow(/No file/);
    expect(deps.pinFile).not.toHaveBeenCalled();
    expect(deps.unpinFile).not.toHaveBeenCalled();
  });

  it("needs a chat to pin into when none is open", async () => {
    const deps = makeDeps({ getActiveSessionId: () => undefined });
    const tools = toolsWith(deps);

    await expect(
      tools.pin_project_file.execute({ path: "artifacts/report.html" }),
    ).rejects.toThrow(/No chat is open/);
    expect(deps.pinFile).not.toHaveBeenCalled();
  });

  it("lists and dismisses this chat's runs", async () => {
    const deps = makeDeps({
      listChatRuns: vi.fn().mockResolvedValue([
        {
          id: "r-1",
          name: "Train",
          addedAt: new Date("2026-11-05T10:00:00Z"),
          dismissed: false,
        },
      ]),
      dismissChatRun: vi.fn().mockResolvedValue(false),
    });
    const tools = toolsWith(deps);

    expect(await tools.list_chat_runs.execute({})).toEqual({
      runs: [
        {
          runId: "r-1",
          name: "Train",
          addedAt: "2026-11-05T10:00:00.000Z",
          dismissed: false,
        },
      ],
    });
    expect(await tools.dismiss_chat_run.execute({ runId: "r-9" })).toEqual({
      dismissed: false,
    });
    expect(deps.listChatRuns).toHaveBeenCalledWith("chat-1");
    expect(deps.dismissChatRun).toHaveBeenCalledWith("chat-1", "r-9");
  });

  it("adds a run and a document to the project", async () => {
    const deps = makeDeps();
    const tools = toolsWith(deps);

    expect(
      await tools.add_run_to_project.execute({ runId: " r-1 ", name: "Train" }),
    ).toEqual({ added: true, target: "run://id/r-1" });
    expect(
      await tools.add_document_to_project.execute({
        title: "Brief",
        content: "",
      }),
    ).toEqual({ target: "document://id/d-9" });

    expect(deps.addRun).toHaveBeenCalledWith("r-1", "Train");
    expect(deps.addDocument).toHaveBeenCalledWith("Brief", "");
  });

  it("refuses a document without text", async () => {
    const deps = makeDeps();
    const tools = toolsWith(deps);

    await expect(
      tools.add_document_to_project.execute({ title: "Brief" }),
    ).rejects.toThrow(/content/);
    expect(deps.addDocument).not.toHaveBeenCalled();
  });
});
