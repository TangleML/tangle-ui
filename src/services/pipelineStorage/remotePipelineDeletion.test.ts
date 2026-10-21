import { afterEach, describe, expect, it, vi } from "vitest";

import {
  admitRemotePipelineWrite,
  assertRemotePipelineAvailable,
  getRemotePipelineDeletionError,
  subscribeRemotePipelineDeletion,
  withRemotePipelineDeletion,
} from "./remotePipelineDeletion";
import type { RemotePipelineRef } from "./types";

afterEach(() => vi.unstubAllGlobals());

describe("remote pipeline deletion signaling", () => {
  it("accepts cooperating tab notices, preserves tombstones, and ignores malformed messages", async () => {
    const channels: FakeBroadcastChannel[] = [];
    class FakeBroadcastChannel extends EventTarget {
      postMessage = vi.fn();
      constructor(readonly name: string) {
        super();
        channels.push(this);
      }
    }
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const ref: RemotePipelineRef = {
      source: "remote",
      backendUrl: "https://backend.example.com",
      pipelineId: "from-another-tab",
    };
    const listener = vi.fn();
    const unsubscribe = subscribeRemotePipelineDeletion(listener);
    const channel = channels[0];
    const admission = admitRemotePipelineWrite(ref.backendUrl, ref);
    const notice = {
      ...ref,
      filePath: "pipelines/from-another-tab.yaml",
      attemptId: "attempt-1",
      state: "pending",
    };
    try {
      expect(channel?.name).toBe("remote-pipeline-deletions");
      channel?.dispatchEvent(
        new MessageEvent("message", { data: { ...notice, pipelineId: 123 } }),
      );
      expect(listener).not.toHaveBeenCalled();
      channel?.dispatchEvent(new MessageEvent("message", { data: notice }));
      expect(() => assertRemotePipelineAvailable(ref.backendUrl, ref)).toThrow(
        "being deleted",
      );
      expect(() => admission.assertWritable()).not.toThrow();
      channel?.dispatchEvent(
        new MessageEvent("message", { data: { ...notice, state: "failed" } }),
      );
      expect(() =>
        assertRemotePipelineAvailable(ref.backendUrl, ref),
      ).not.toThrow();
      channel?.dispatchEvent(
        new MessageEvent("message", { data: { ...notice, state: "deleted" } }),
      );
      channel?.dispatchEvent(
        new MessageEvent("message", {
          data: { ...notice, state: "failed", attemptId: "older-attempt" },
        }),
      );
      expect(getRemotePipelineDeletionError(ref)?.message).toContain(
        "was deleted",
      );
      expect(() => admission.assertWritable()).toThrow("was deleted");
      expect(channel?.postMessage).not.toHaveBeenCalled();

      const local = { ...ref, pipelineId: "from-this-tab" };
      await withRemotePipelineDeletion(
        local,
        "pipelines/from-this-tab.yaml",
        async () => {},
      );
      expect(channel?.postMessage).toHaveBeenCalledTimes(2);
      expect(channel?.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pipelineId: local.pipelineId,
          state: "deleted",
        }),
      );
    } finally {
      unsubscribe();
    }
  });
});
