import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AutoSaveIndicator } from "./AutoSaveIndicator";

const { storage } = vi.hoisted(() => ({
  storage: { canMigrate: vi.fn() },
}));

const autoSave = observable(
  {
    error: null as string | null,
    isSaving: false,
    hasUnsavedChanges: false,
    lastSavedAt: null as Date | null,
    save: vi.fn(),
  },
  { save: false },
);

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
    autoSave.lastSavedAt = null;
    storage.canMigrate.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
  ])(
    "shows $status through the icon and accessible feedback",
    ({ saving, unsaved, status }) => {
      autoSave.isSaving = saving;
      autoSave.hasUnsavedChanges = unsaved;
      file.saveError = "Not saved to server";
      render(<AutoSaveIndicator />);
      expect(screen.getByText(status)).toHaveClass("sr-only");
      const button = screen.getByTestId("auto-save-button");
      expect(button).toHaveAccessibleDescription(status);
      expect(button).toHaveAttribute("aria-busy", String(saving));
      expect(button.querySelector(".lucide-cloud")).not.toBeNull();
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Retry" }),
      ).not.toBeInTheDocument();
      expect(button.hasAttribute("disabled")).toBe(saving);
      if (unsaved) {
        fireEvent.click(button);
        expect(autoSave.save).toHaveBeenCalledOnce();
      }
    },
  );

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

  it("confirms a completed server save for 750ms and restarts for the next save", () => {
    vi.useFakeTimers();
    autoSave.isSaving = true;
    render(<AutoSaveIndicator />);
    const cloud = () =>
      screen.getByTestId("auto-save-button").querySelector(".lucide-cloud");

    act(() => {
      runInAction(() => {
        autoSave.lastSavedAt = new Date();
      });
    });
    expect(cloud()).toHaveClass("text-yellow-200");
    expect(cloud()).not.toHaveClass("animate-pipeline-save-success");

    act(() => {
      runInAction(() => {
        autoSave.isSaving = false;
      });
    });
    expect(cloud()).toHaveClass("animate-pipeline-save-success");
    expect(screen.getByTestId("auto-save-button")).toHaveAccessibleDescription(
      "Saved",
    );
    expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(500));
    act(() => {
      runInAction(() => {
        autoSave.isSaving = true;
        autoSave.hasUnsavedChanges = true;
      });
    });
    expect(cloud()).toHaveClass("text-yellow-200");
    expect(cloud()).not.toHaveClass("animate-pipeline-save-success");

    act(() => {
      runInAction(() => {
        autoSave.lastSavedAt = new Date();
        autoSave.isSaving = false;
        autoSave.hasUnsavedChanges = false;
      });
    });
    act(() => vi.advanceTimersByTime(749));
    expect(cloud()).toHaveClass("animate-pipeline-save-success");
    act(() => vi.advanceTimersByTime(1));
    expect(cloud()).not.toHaveClass("animate-pipeline-save-success");
    expect(cloud()).not.toHaveClass("text-yellow-200", "text-emerald-300");
  });

  it.each(["failed save", "newer edits"])(
    "does not confirm an older save after %s",
    (reason) => {
      autoSave.isSaving = true;
      render(<AutoSaveIndicator />);
      act(() => {
        runInAction(() => {
          autoSave.lastSavedAt = new Date();
          autoSave.isSaving = false;
          autoSave.hasUnsavedChanges = true;
          if (reason === "failed save") autoSave.error = "Network unavailable";
        });
      });
      expect(screen.queryByText("Saved")).not.toBeInTheDocument();
      act(() => {
        runInAction(() => {
          autoSave.error = null;
          autoSave.hasUnsavedChanges = false;
        });
      });
      expect(
        screen.getByTestId("auto-save-button").querySelector(".lucide-cloud"),
      ).not.toHaveClass("animate-pipeline-save-success");
    },
  );

  it("does not replay a previous save when the indicator mounts", () => {
    autoSave.lastSavedAt = new Date();
    render(<AutoSaveIndicator />);
    expect(
      screen.getByTestId("auto-save-button").querySelector(".lucide-cloud"),
    ).not.toHaveClass("animate-pipeline-save-success");
  });
});
