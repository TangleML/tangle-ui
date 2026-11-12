import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import {
  draftPipelineIdentity,
  idIdentity,
  remotePipelineIdentity,
} from "@/services/projects/resourceTarget";

import { readOpenTabs, rememberOpenTabs } from "./openTabsStorage";
import type { OpenTabs, WorkareaTarget } from "./types";

const STORAGE_KEY = "tangent-open-tabs";

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

function visit(projectId: string): TangentProjectStore {
  const store = new TangentProjectStore(projectId, readOpenTabs(projectId));
  disposers.push(rememberOpenTabs(store));
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

    expect(titles(readOpenTabs("project-1"))).toEqual(["Churn model"]);
    expect(titles(readOpenTabs("project-2"))).toEqual(["Nightly"]);
    expect(readOpenTabs("project-3")).toEqual({ tabs: [], activeId: null });
  });

  it("keep a tab's new name and address", () => {
    const store = visit("project-1");
    const tab = store.openResolvedView({ title: "Untitled", target: unsaved });

    store.replaceWorkareaTabTarget(tab.id, pipeline);
    store.retitleWorkareaTarget(pipeline, "Churn model");

    expect(
      readOpenTabs("project-1").tabs.map(({ title, target }) => ({
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

    expect(readOpenTabs("project-1").tabs).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("leave out an unsaved pipeline, which a later visit couldn't reopen", () => {
    const store = visit("project-1");
    store.openResolvedView({ title: "Churn model", target: pipeline });
    store.openResolvedView({ title: "Untitled", target: unsaved });

    const saved = readOpenTabs("project-1");

    expect(titles(saved)).toEqual(["Churn model"]);
    expect(inFront(saved)).toBe("Churn model");
  });

  it("stop being saved once the visit ends", () => {
    const store = new TangentProjectStore("project-1");
    const stop = rememberOpenTabs(store);

    stop();
    store.openResolvedView({ title: "Churn model", target: pipeline });

    expect(readOpenTabs("project-1").tabs).toEqual([]);
  });

  it("skip anything saved that isn't a tab", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        "project-1": {
          tabs: [
            { title: "Churn model", target: "pipeline://remote/p-1" },
            { title: "Unknown kind", target: "notebook://id/1" },
            { title: "Wrong address", target: "run://name/nightly" },
            { target: "run://id/r-1" },
            "nonsense",
          ],
          active: "run://id/closed-since",
        },
        "project-2": "nonsense",
      }),
    );

    const saved = readOpenTabs("project-1");

    expect(saved.tabs.map(({ title, target }) => ({ title, target }))).toEqual([
      { title: "Churn model", target: pipeline },
    ]);
    expect(inFront(saved)).toBe("Churn model");
    expect(readOpenTabs("project-2")).toEqual({ tabs: [], activeId: null });
  });

  it("read as none when what was saved can't be read", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");

    expect(readOpenTabs("project-1")).toEqual({ tabs: [], activeId: null });
  });
});
