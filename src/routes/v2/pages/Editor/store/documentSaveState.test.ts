import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { AUTOSAVE_DEBOUNCE_TIME_MS } from "@/utils/constants";

import { DocumentSaveState } from "./documentSaveState";

const documents: DocumentSaveState[] = [];
function setup(name = "Original") {
  const spec = new ComponentSpec({ name });
  const file = new PipelineFile({
    ref: {
      source: "draft",
      backendUrl: "https://example.com",
      draftId: name,
      name,
    },
  });
  const write = vi.spyOn(file, "write").mockResolvedValue();
  const state = new DocumentSaveState(spec, file);
  documents.push(state);
  return { spec, file, state, write };
}
function unloadPrevented() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  documents.splice(0).forEach((state) => state.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("only creates an untouched draft on explicit Save", async () => {
  const { state, write } = setup();
  await state.flush();
  expect(write).not.toHaveBeenCalled();
  await state.save();
  expect(write).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ name: "Original" }),
  );
  expect(state.isSaving).toBe(false);
});

it("debounces edits as typed snapshots and protects the document until the write finishes", async () => {
  const { spec, state, write } = setup();
  const pending = Promise.withResolvers<void>();
  write.mockReturnValue(pending.promise);
  spec.setName("Edited");
  expect(unloadPrevented()).toBe(true);
  await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS - 1);
  expect(write).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(write).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ name: "Edited" }),
  );
  expect(state.isSaving).toBe(true);
  pending.resolve();
  await state.pendingSave?.promise;
  expect(state.isSaving).toBe(false);
  expect(state.hasUnsavedChanges).toBe(false);
  expect(unloadPrevented()).toBe(false);
});

it("deduplicates a pending snapshot and retains failed edits for retry", async () => {
  const { spec, state, write } = setup();
  const pending = Promise.withResolvers<void>();
  write.mockReturnValueOnce(pending.promise);
  spec.setName("Unsaved");
  const first = state.save();
  const second = state.flush();
  const failed = Promise.allSettled([first, second]);
  expect(write).toHaveBeenCalledOnce();
  pending.reject(new Error("Unavailable"));
  await failed;
  expect(state.error).toBe("Unavailable");
  expect(unloadPrevented()).toBe(true);
  await state.save();
  expect(write).toHaveBeenCalledTimes(2);
  expect(state.error).toBeNull();
  expect(unloadPrevented()).toBe(false);
});

it("keeps the latest failed snapshot dirty after an older save succeeds", async () => {
  const { spec, state, write } = setup();
  const old = Promise.withResolvers<void>();
  const next = Promise.withResolvers<void>();
  write.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  spec.setName("First edit");
  const first = state.save();
  spec.setName("Second edit");
  const second = state.save();
  const results = Promise.allSettled([first, second]);
  old.resolve();
  await first;
  expect(state.hasPendingWrites).toBe(true);
  next.reject(new Error("Response lost"));
  await results;
  expect(state.currentSnapshot).toContain("Second edit");
  expect(state.lastSavedSnapshot).toBeNull();
  expect(state.hasUnsavedChanges).toBe(true);
  expect(state.hasPendingWrites).toBe(false);
});

it("writes a return to the baseline when an intermediate write may have reached the server", async () => {
  const { spec, state, write } = setup();
  write.mockRejectedValueOnce(new Error("Response lost"));
  spec.setName("Intermediate");
  await expect(state.save()).rejects.toThrow("Response lost");
  spec.setName("Original");
  await state.save();
  expect(write).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenLastCalledWith(
    expect.objectContaining({ name: "Original" }),
  );
});

it("keeps unload protection for other dirty documents when one is saved or disposed", async () => {
  const first = setup("First");
  const second = setup("Second");
  first.spec.setName("First changed");
  second.spec.setName("Second changed");
  await first.state.save();
  first.state.dispose();
  expect(unloadPrevented()).toBe(true);
  await second.state.save();
  expect(unloadPrevented()).toBe(false);
});
