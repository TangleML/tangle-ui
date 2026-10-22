import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { runInAction } from "mobx";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentSaveState } from "@/routes/v2/pages/Editor/store/documentSaveState";
import { RemotePipelineDeletionUncertainError } from "@/services/pipelineStorage/remotePipelineDeletion";
import {
  getEditorPipelineIdentity,
  type RemotePipelineRef,
} from "@/services/pipelineStorage/types";

import {
  EDITOR_SPEC_QUERY_KEY,
  reconcileDeletedRemotePipeline,
} from "./deletedRemotePipelineCache";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const remote: RemotePipelineRef = {
  source: "remote",
  backendUrl: "https://backend.example.com",
  pipelineId: "deleted-pipeline",
};
const queryKey = [EDITOR_SPEC_QUERY_KEY, getEditorPipelineIdentity(remote)];

function document(ref = remote) {
  return {
    file: { remote: ref },
    saveState: new DocumentSaveState("saved"),
    spec: { name: "Recoverable edits" },
  };
}

afterEach(() => client.clear());

describe("reconcileDeletedRemotePipeline", () => {
  it("does not turn a clean document into unsaved changes when the DELETE result is unknown", async () => {
    const uncertain = document();
    client.setQueryData(queryKey, uncertain);

    await reconcileDeletedRemotePipeline(
      client,
      remote,
      new RemotePipelineDeletionUncertainError(),
    );

    expect(client.getQueryData(queryKey)).toBeUndefined();
    expect(uncertain.saveState.hasUnsavedChanges).toBe(false);
  });

  it("removes a clean inactive editor without affecting another backend", async () => {
    const other = { ...remote, backendUrl: "https://other.example.com" };
    const otherKey = [EDITOR_SPEC_QUERY_KEY, getEditorPipelineIdentity(other)];
    const otherDocument = document(other);
    client.setQueryData(queryKey, document());
    client.setQueryData(otherKey, otherDocument);

    await reconcileDeletedRemotePipeline(client, remote);

    expect(client.getQueryData(queryKey)).toBeUndefined();
    expect(client.getQueryData(otherKey)).toBe(otherDocument);
  });

  it("retains dirty draft and remote aliases with the same model and a recovery error", async () => {
    const dirty = document();
    runInAction(() => {
      dirty.saveState.currentYaml = "unsaved";
    });
    const draftKey = [EDITOR_SPEC_QUERY_KEY, "draft-alias"];
    client.setQueryData(queryKey, dirty);
    client.setQueryData(draftKey, dirty);

    await reconcileDeletedRemotePipeline(client, remote);

    expect(client.getQueryData(queryKey)).toBe(dirty);
    expect(client.getQueryData(draftKey)).toBe(dirty);
    expect(dirty.saveState.error).toContain("Save a copy to keep your changes");
    expect(dirty.saveState.hasUnsavedChanges).toBe(true);
  });

  it("waits for the saving indicator before preserving newer unsaved edits", async () => {
    const dirty = document();
    const pending = Promise.withResolvers<void>();
    runInAction(() => {
      dirty.saveState.currentYaml = "newer edit";
      dirty.saveState.pendingCount = 1;
    });
    dirty.saveState.pendingSave = {
      yaml: "older edit",
      promise: pending.promise.then(() => {
        runInAction(() => {
          dirty.saveState.error = null;
          dirty.saveState.lastSavedYaml = "older edit";
          dirty.saveState.pendingCount = 0;
        });
      }),
    };
    client.setQueryData(queryKey, dirty);

    const reconciliation = reconcileDeletedRemotePipeline(client, remote);
    await Promise.resolve();
    expect(dirty.saveState.error).toBeNull();
    pending.resolve();
    await reconciliation;

    expect(client.getQueryData(queryKey)).toBe(dirty);
    expect(dirty.saveState.currentYaml).toBe("newer edit");
    expect(dirty.saveState.error).toContain("was deleted");
  });

  it("resets an active clean editor so it reloads through the storage barrier", async () => {
    client.setQueryData(queryKey, document());
    const load = vi
      .fn()
      .mockRejectedValue(new Error("This pipeline was deleted"));
    const observer = new QueryObserver(client, {
      queryKey,
      queryFn: load,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await reconcileDeletedRemotePipeline(client, remote);
      expect(load).toHaveBeenCalledOnce();
      expect(observer.getCurrentResult().data).toBeUndefined();
      expect(observer.getCurrentResult().error?.message).toContain(
        "was deleted",
      );
    } finally {
      unsubscribe();
    }
  });
});
