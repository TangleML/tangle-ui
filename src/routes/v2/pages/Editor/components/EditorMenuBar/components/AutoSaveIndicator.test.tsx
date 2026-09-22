import { act, fireEvent, render, screen } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AutoSaveIndicator } from "./AutoSaveIndicator";

const { autoSave, storage } = vi.hoisted(() => ({
  autoSave: {
    error: null as string | null,
    isSaving: false,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    save: vi.fn(),
  },
  storage: { canMigrate: vi.fn() },
}));

const file = observable({
  canEdit: true,
  storageKind: "remote",
  saveError: undefined as string | undefined,
  isSaving: false,
});

vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));

vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => ({
    autoSave,
    pipelineFile: { activePipelineFile: file },
  }),
}));

describe("AutoSaveIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    file.canEdit = true;
    file.storageKind = "remote";
    file.saveError = undefined;
    file.isSaving = false;
    autoSave.error = null;
    autoSave.isSaving = false;
    autoSave.hasUnsavedChanges = false;
    storage.canMigrate.mockReturnValue(false);
  });

  it("publishes a local pipeline from the header and switches to cloud status", () => {
    file.storageKind = "local";
    storage.canMigrate.mockReturnValue(true);
    render(<AutoSaveIndicator />);
    expect(screen.queryByText("Local")).not.toBeInTheDocument();
    expect(
      screen
        .getByTestId("auto-save-button")
        .querySelector(".lucide-hard-drive"),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save to server" }));
    expect(autoSave.save).toHaveBeenCalledOnce();

    act(() => {
      storage.canMigrate.mockReturnValue(false);
      runInAction(() => {
        file.storageKind = "remote";
      });
    });
    expect(screen.queryByText("Remote")).not.toBeInTheDocument();
    expect(screen.queryByText("Local")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("auto-save-button").querySelector(".lucide-cloud"),
    ).not.toBeNull();
  });

  it("uses the disk icon for local-only saves without a storage label", () => {
    file.storageKind = "local";
    render(<AutoSaveIndicator />);
    const button = screen.getByRole("button", { name: "Save pipeline" });
    expect(button.querySelector(".lucide-hard-drive")).not.toBeNull();
    expect(screen.queryByText("Local")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(autoSave.save).toHaveBeenCalledOnce();
  });

  it.each([
    { saving: true, unsaved: false, status: "Saving..." },
    { saving: false, unsaved: true, status: "Unsaved changes" },
  ])("retains $status feedback", ({ saving, unsaved, status }) => {
    autoSave.isSaving = saving;
    autoSave.hasUnsavedChanges = unsaved;
    file.saveError = "Not saved to server";
    render(<AutoSaveIndicator />);
    expect(screen.getByText(status)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("auto-save-button").hasAttribute("disabled"),
    ).toBe(saving);
  });

  it("retries publication after a failed local-to-server save", () => {
    file.storageKind = "local";
    storage.canMigrate.mockReturnValue(true);
    autoSave.error = "Server unavailable";
    render(<AutoSaveIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(autoSave.save).toHaveBeenCalledOnce();
  });

  it("makes a failed server save visible and lets the owner retry", () => {
    autoSave.error = "Network unavailable";
    render(<AutoSaveIndicator />);
    expect(screen.getByText("Not saved to server")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(autoSave.save).toHaveBeenCalledOnce();
  });

  it("identifies a new pipeline whose first upload failed", () => {
    file.storageKind = "pending";
    file.saveError = "Network unavailable";
    render(<AutoSaveIndicator />);
    expect(screen.getByText("Pending upload")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("identifies another owner's remote pipeline without allowing save", () => {
    file.canEdit = false;
    render(<AutoSaveIndicator />);
    expect(screen.queryByText(/Remote|view only/)).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "View-only pipeline" });
    expect(button).toBeDisabled();
    expect(button.querySelector(".lucide-cloud")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });
});
