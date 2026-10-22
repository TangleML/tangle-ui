import { normalizePipelineId } from "@/services/pipelineId";
import { normalizeBackendUrl } from "@/utils/backendIdentity";

import type { RemotePipelineRef } from "./types";

export interface RemotePipelineDeletion extends RemotePipelineRef {
  filePath: string;
  attemptId: string;
  state: "pending" | "deleted" | "failed" | "uncertain";
}

const deletions = new Map<
  string,
  RemotePipelineDeletion & { wasUncertain?: boolean }
>();
const FOREIGN_PENDING_TIMEOUT_MS = 30_000;
const listeners = new Set<(deletion: RemotePipelineDeletion) => void>();
let channel: BroadcastChannel | undefined;

function key(backendUrl: string, kind: string, value: string): string {
  return JSON.stringify([
    normalizeBackendUrl(backendUrl),
    kind,
    kind === "id" ? normalizePipelineId(value) : value,
  ]);
}

function applyDeletion(deletion: RemotePipelineDeletion): void {
  for (const entry of [
    key(deletion.backendUrl, "id", deletion.pipelineId),
    key(deletion.backendUrl, "path", deletion.filePath),
  ]) {
    const current = deletions.get(entry);
    if (deletion.state === "failed") {
      if (
        current?.state === "pending" &&
        current.attemptId === deletion.attemptId
      ) {
        if (current.wasUncertain) {
          deletions.set(entry, { ...current, state: "uncertain" });
        } else deletions.delete(entry);
      }
    } else if (current?.state !== "deleted") {
      deletions.set(entry, {
        ...deletion,
        wasUncertain:
          deletion.state === "pending" &&
          (current?.state === "uncertain" || current?.wasUncertain),
      });
    }
  }
  for (const listener of listeners) {
    try {
      const effective = deletions.get(
        key(deletion.backendUrl, "id", deletion.pipelineId),
      );
      listener(
        deletion.state === "failed" && effective?.state === "uncertain"
          ? { ...deletion, state: "uncertain" }
          : deletion,
      );
    } catch (error) {
      console.warn(
        "Failed to update a deleted pipeline's editor state:",
        error,
      );
    }
  }
}

function connectChannel(): void {
  if (
    channel ||
    typeof window === "undefined" ||
    typeof window.BroadcastChannel !== "function"
  )
    return;
  try {
    channel = new window.BroadcastChannel("remote-pipeline-deletions");
  } catch (error) {
    console.warn("Pipeline deletion notifications are unavailable:", error);
    return;
  }
  channel.addEventListener("message", ({ data }: MessageEvent<unknown>) => {
    if (
      !data ||
      typeof data !== "object" ||
      !("source" in data) ||
      data.source !== "remote" ||
      !("backendUrl" in data) ||
      typeof data.backendUrl !== "string" ||
      !("pipelineId" in data) ||
      typeof data.pipelineId !== "string" ||
      !("filePath" in data) ||
      typeof data.filePath !== "string" ||
      !("attemptId" in data) ||
      typeof data.attemptId !== "string" ||
      !("state" in data) ||
      (data.state !== "pending" &&
        data.state !== "deleted" &&
        data.state !== "failed" &&
        data.state !== "uncertain")
    )
      return;
    const deletion: RemotePipelineDeletion = {
      source: "remote",
      backendUrl: data.backendUrl,
      pipelineId: data.pipelineId,
      filePath: data.filePath,
      attemptId: data.attemptId,
      state: data.state,
    };
    applyDeletion(deletion);
    if (deletion.state === "pending")
      setTimeout(() => {
        const current = deletions.get(
          key(deletion.backendUrl, "id", deletion.pipelineId),
        );
        if (
          current?.state === "pending" &&
          current.attemptId === deletion.attemptId
        )
          applyDeletion({ ...deletion, state: "uncertain" });
      }, FOREIGN_PENDING_TIMEOUT_MS);
  });
}

function publish(deletion: RemotePipelineDeletion): void {
  applyDeletion(deletion);
  connectChannel();
  try {
    channel?.postMessage(deletion);
  } catch (error) {
    console.warn("Failed to notify other tabs of a pipeline deletion:", error);
  }
}

export class RemotePipelineDeletionError extends Error {
  constructor(
    readonly state: "pending" | "deleted" | "uncertain",
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "RemotePipelineDeletionError";
  }
}

export function remotePipelineDeletionError(): Error {
  return new RemotePipelineDeletionError(
    "deleted",
    "This pipeline was deleted. Save a copy to keep your changes.",
  );
}

export class RemotePipelineDeletionUncertainError extends RemotePipelineDeletionError {
  constructor(cause?: unknown) {
    super(
      "uncertain",
      "The deletion result is unknown. Delete again to confirm, or save a copy to keep your changes.",
      cause,
    );
  }
}

function assertDeletionAvailable(
  deletion?: RemotePipelineDeletion,
  allowPending = false,
): void {
  if (deletion?.state === "deleted") throw remotePipelineDeletionError();
  if (deletion?.state === "uncertain")
    throw new RemotePipelineDeletionUncertainError();
  if (deletion?.state === "pending" && !allowPending) {
    throw new RemotePipelineDeletionError(
      "pending",
      "This pipeline is being deleted. Save a copy to keep your changes.",
    );
  }
}

export function assertRemotePipelineAvailable(
  backendUrl: string,
  identity: { pipelineId: string } | { filePath: string },
  allowPending = false,
): void {
  connectChannel();
  const deletion = deletions.get(
    "pipelineId" in identity
      ? key(backendUrl, "id", identity.pipelineId)
      : key(backendUrl, "path", identity.filePath),
  );
  assertDeletionAvailable(deletion, allowPending);
}

export function getRemotePipelineDeletionError(
  ref: RemotePipelineRef,
): Error | undefined {
  connectChannel();
  const state = deletions.get(key(ref.backendUrl, "id", ref.pipelineId))?.state;
  if (state === "deleted") return remotePipelineDeletionError();
  if (state === "uncertain") return new RemotePipelineDeletionUncertainError();
  if (state === "pending")
    return new RemotePipelineDeletionError(
      "pending",
      "This pipeline is being deleted. Save a copy to keep your changes.",
    );
}

export interface RemotePipelineWriteAdmission {
  assertWritable: () => void;
}

export function admitRemotePipelineWrite(
  backendUrl: string,
  identity: { pipelineId: string } | { filePath: string },
): RemotePipelineWriteAdmission {
  assertRemotePipelineAvailable(backendUrl, identity);
  // Deletion drains admitted work. Nested draft writes retain their admission
  // when they reach the remote queue, but cannot write after deletion finishes.
  return {
    assertWritable: () =>
      assertRemotePipelineAvailable(backendUrl, identity, true),
  };
}

export function subscribeRemotePipelineDeletion(
  listener: (deletion: RemotePipelineDeletion) => void,
): () => void {
  connectChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function withRemotePipelineDeletion(
  ref: RemotePipelineRef,
  filePath: string,
  remove: () => Promise<void>,
): Promise<void> {
  const previous = [
    deletions.get(key(ref.backendUrl, "id", ref.pipelineId)),
    deletions.get(key(ref.backendUrl, "path", filePath)),
  ];
  for (const deletion of previous) {
    if (deletion?.state !== "uncertain") assertDeletionAvailable(deletion);
  }
  const retryingUncertain = previous.some(
    (deletion) => deletion?.state === "uncertain",
  );
  const deletion: RemotePipelineDeletion = {
    ...ref,
    filePath,
    attemptId: crypto.randomUUID(),
    state: "pending",
  };
  publish(deletion);
  try {
    await remove();
    publish({ ...deletion, state: "deleted" });
  } catch (error) {
    publish({
      ...deletion,
      state:
        retryingUncertain ||
        error instanceof RemotePipelineDeletionUncertainError
          ? "uncertain"
          : "failed",
    });
    throw error;
  }
}
