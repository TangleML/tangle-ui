import { runInAction } from "mobx";
import { describe, expect, it } from "vitest";

import { DocumentSaveState } from "./documentSaveState";

function unloadIsPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("unsaved document unload protection", () => {
  it("warns for debounced edits and pending writes, then stops after saving", () => {
    const document = new DocumentSaveState("Original");
    const release = document.protectUnsavedChanges();
    expect(unloadIsPrevented()).toBe(false);

    runInAction(() => {
      document.currentYaml = "Edited";
    });
    expect(unloadIsPrevented()).toBe(true);

    runInAction(() => {
      document.pendingCount = 1;
      document.currentYaml = "Original";
    });
    expect(unloadIsPrevented()).toBe(true);

    runInAction(() => {
      document.pendingCount = 0;
    });
    expect(unloadIsPrevented()).toBe(false);
    release();
  });

  it("keeps a failed document protected after leaving the editor and through reopen", () => {
    const document = new DocumentSaveState("Original");
    const release = document.protectUnsavedChanges();
    runInAction(() => {
      document.currentYaml = "Unsaved";
      document.error = "Save failed";
    });
    release();
    expect(unloadIsPrevented()).toBe(true);

    const releaseReopened = document.protectUnsavedChanges();
    runInAction(() => {
      document.pendingCount = 1;
    });
    releaseReopened();
    expect(unloadIsPrevented()).toBe(true);

    runInAction(() => {
      document.lastSavedYaml = "Unsaved";
      document.error = null;
      document.pendingCount = 0;
    });
    document.releaseIfSaved();
    expect(unloadIsPrevented()).toBe(false);
  });

  it("continues protecting other retained documents when one finishes saving", () => {
    const first = new DocumentSaveState("First");
    const second = new DocumentSaveState("Second");
    const releaseFirst = first.protectUnsavedChanges();
    const releaseSecond = second.protectUnsavedChanges();
    runInAction(() => {
      first.currentYaml = "First edited";
      second.currentYaml = "Second edited";
    });
    releaseFirst();
    releaseSecond();

    runInAction(() => {
      first.lastSavedYaml = first.currentYaml;
    });
    first.releaseIfSaved();
    expect(unloadIsPrevented()).toBe(true);

    runInAction(() => {
      second.lastSavedYaml = second.currentYaml;
    });
    second.releaseIfSaved();
    expect(unloadIsPrevented()).toBe(false);
  });
});
