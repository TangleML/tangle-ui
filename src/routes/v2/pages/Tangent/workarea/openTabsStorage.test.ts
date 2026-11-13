import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import {
  draftPipelineIdentity,
  idIdentity,
  remotePipelineIdentity,
} from "@/services/projects/resourceTarget";

import { readOpenTabs, rememberOpenTabs } from "./openTabsStorage";
import type { OpenTabs, WorkareaTarget } from "./types";

const STORAGE_KEY = "tangent-open-tabs-by-user";
const OLD_STORAGE_KEY = "tangent-open-tabs";
const TANGENT = "https://tangent.example";
const USER = "user-1";

const chatFile: WorkareaTarget = {
  type: "artifact",
  identity: idIdentity(`${TANGENT}/api/sessions/chat-a/files/report.html`),
};

function saved(projectId: string, userId = USER, tangent = TANGENT) {
  return readOpenTabs({ userId, projectId }, tangent);
}

const pipeline: WorkareaTarget = {
  type: "pipeline",
  identity: remotePipelineIdentity("p-1"),
};
const run: WorkareaTarget = { type: "run", identity: idIdentity("r-1") };
const unsaved: WorkareaTarget = {
  type: "pipeline",
  identity: draftPipelineIdentity("d-1"),
};

const disposers: (() => void)[] = [];

function visit(projectId: string, userId = USER): TangentProjectStore {
  const store = new TangentProjectStore(projectId, saved(projectId, userId));
  store.setTangentBaseUrl(TANGENT);
  disposers.push(rememberOpenTabs(store, userId));
  return store;
}

function titles({ tabs }: OpenTabs): string[] {
  return tabs.map((tab) => tab.title);
}

function inFront({ tabs, activeId }: OpenTabs): string | undefined {
  return tabs.find((tab) => tab.id === activeId)?.title;
}

describe("a project's open tabs", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
  });

  it("come back on the next visit with the same tab in front", () => {
    const first = visit("project-1");
    const churn = first.openResolvedView({
      title: "Churn model",
      target: pipeline,
    });
    first.openResolvedView({ title: "Nightly", target: run });
    first.selectWorkareaTab(churn.id);

    const next = visit("project-1");

    expect(
      next.workareaTabs.map(({ title, target }) => ({ title, target })),
    ).toEqual([
      { title: "Churn model", target: pipeline },
      { title: "Nightly", target: run },
    ]);
    expect(inFront(next.openTabs)).toBe("Churn model");
  });

  it("are kept apart for each project", () => {
    visit("project-1").openResolvedView({
      title: "Churn model",
      target: pipeline,
    });
    visit("project-2").openResolvedView({ title: "Nightly", target: run });

    expect(titles(saved("project-1"))).toEqual(["Churn model"]);
    expect(titles(saved("project-2"))).toEqual(["Nightly"]);
    expect(saved("project-3")).toEqual({ tabs: [], activeId: null });
  });

  it("keep a tab's new name and address", () => {
    const store = visit("project-1");
    const tab = store.openResolvedView({ title: "Untitled", target: unsaved });

    store.replaceWorkareaTabTarget(tab.id, pipeline);
    store.retitleWorkareaTarget(pipeline, "Churn model");

    expect(
      saved("project-1").tabs.map(({ title, target }) => ({
        title,
        target,
      })),
    ).toEqual([{ title: "Churn model", target: pipeline }]);
  });

  it("forget a tab once it's closed", () => {
    const store = visit("project-1");
    const tab = store.openResolvedView({
      title: "Churn model",
      target: pipeline,
    });

    store.closeWorkareaTab(tab.id);

    expect(saved("project-1").tabs).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("leave out an unsaved pipeline, which a later visit couldn't reopen", () => {
    const store = visit("project-1");
    store.openResolvedView({ title: "Churn model", target: pipeline });
    store.openResolvedView({ title: "Untitled", target: unsaved });

    const tabs = saved("project-1");

    expect(titles(tabs)).toEqual(["Churn model"]);
    expect(inFront(tabs)).toBe("Churn model");
  });

  it("stop being saved once the visit ends", () => {
    const store = new TangentProjectStore("project-1");
    const stop = rememberOpenTabs(store, USER);

    stop();
    store.openResolvedView({ title: "Churn model", target: pipeline });

    expect(saved("project-1").tabs).toEqual([]);
  });

  it("skip anything saved that isn't a tab", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [USER]: {
          "project-1": {
            tabs: [
              { title: "Churn model", target: "pipeline://remote/p-1" },
              { title: "Unknown kind", target: "notebook://id/1" },
              { title: "Wrong address", target: "run://name/nightly" },
              { title: "Not a run's id", target: "run://id/../../users/me" },
              { target: "run://id/r-1" },
              "nonsense",
            ],
            active: "run://id/closed-since",
          },
          "project-2": "nonsense",
        },
        "user-2": "nonsense",
      }),
    );

    const tabs = saved("project-1");

    expect(tabs.tabs.map(({ title, target }) => ({ title, target }))).toEqual([
      { title: "Churn model", target: pipeline },
    ]);
    expect(inFront(tabs)).toBe("Churn model");
    expect(saved("project-2")).toEqual({ tabs: [], activeId: null });
  });

  it("read as none when what was saved can't be read", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");

    expect(saved("project-1")).toEqual({ tabs: [], activeId: null });
  });

  it("bring back a file from one of this Tangent's chats", () => {
    visit("project-1").openResolvedView({ title: "Report", target: chatFile });

    expect(
      saved("project-1").tabs.map(({ title, target }) => ({ title, target })),
    ).toEqual([{ title: "Report", target: chatFile }]);
  });

  it("drop a saved file tab that points outside this Tangent", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [USER]: {
          "project-1": {
            tabs: [
              { title: "Churn model", target: "pipeline://remote/p-1" },
              {
                title: "Outside page",
                target: "artifact://id/https://evil.example/page.html",
              },
              {
                title: "Lookalike",
                target:
                  "artifact://id/https://evil.example/api/sessions/chat-a/files/report.html",
              },
              { title: "Script", target: "artifact://id/javascript:alert(1)" },
            ],
            active: "artifact://id/https://evil.example/page.html",
          },
        },
      }),
    );

    const tabs = saved("project-1");

    expect(titles(tabs)).toEqual(["Churn model"]);
    expect(inFront(tabs)).toBe("Churn model");
  });

  it("drop a file tab saved against a Tangent the project no longer uses", () => {
    visit("project-1").openResolvedView({ title: "Report", target: chatFile });

    expect(
      titles(saved("project-1", USER, "https://other-tangent.example")),
    ).toEqual([]);
  });

  it("are kept apart for each person using this browser", () => {
    visit("project-1", "user-1").openResolvedView({
      title: "Churn model",
      target: pipeline,
    });
    visit("project-1", "user-2").openResolvedView({
      title: "Nightly",
      target: run,
    });

    expect(titles(saved("project-1", "user-1"))).toEqual(["Churn model"]);
    expect(titles(saved("project-1", "user-2"))).toEqual(["Nightly"]);
    expect(titles(saved("project-1", "user-3"))).toEqual([]);
  });

  it("leave another person's tabs alone when the last of one's own closes", () => {
    visit("project-1", "user-2").openResolvedView({
      title: "Nightly",
      target: run,
    });
    const store = visit("project-1", "user-1");
    const tab = store.openResolvedView({
      title: "Churn model",
      target: pipeline,
    });

    store.closeWorkareaTab(tab.id);

    expect(titles(saved("project-1", "user-1"))).toEqual([]);
    expect(titles(saved("project-1", "user-2"))).toEqual(["Nightly"]);
  });

  it("ignore tabs saved before they were kept per person", () => {
    localStorage.setItem(
      OLD_STORAGE_KEY,
      JSON.stringify({
        "project-1": {
          tabs: [{ title: "Churn model", target: "pipeline://remote/p-1" }],
        },
      }),
    );

    expect(saved("project-1").tabs).toEqual([]);
    expect(saved("project-1", "project-1").tabs).toEqual([]);
  });

  it("aren't mixed up by a person or project named like a built-in", () => {
    expect(saved("constructor", "__proto__").tabs).toEqual([]);
    expect(saved("toString", "constructor").tabs).toEqual([]);
  });
});
