import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { EditorStore } from "@/routes/v2/shared/store/editorStore";
import { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import { downloadStringAsFile } from "@/utils/URL";

import { RemotePipelineSaveRecovery } from "./RemotePipelineSaveRecovery";

const autoSave = {
  error: "The backend is unavailable.",
  isSaving: false,
  save: vi.fn(),
};
const navigation = new NavigationStore(new EditorStore());
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => ({ autoSave }),
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ navigation }),
}));
vi.mock("@/utils/URL", () => ({ downloadStringAsFile: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  autoSave.error = "The backend is unavailable.";
  autoSave.isSaving = false;
  autoSave.save.mockResolvedValue(undefined);
  navigation.initNavigation(
    new ComponentSpec({ name: "Recovery", description: "Unsaved edits" }),
  );
});

it("exports the unsaved model without clearing the save error", () => {
  render(<RemotePipelineSaveRecovery />);
  fireEvent.click(screen.getByRole("button", { name: "Export YAML" }));
  expect(downloadStringAsFile).toHaveBeenCalledWith(
    expect.stringContaining("Unsaved edits"),
    "Recovery.pipeline.component.yaml",
    "text/yaml",
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "The backend is unavailable.",
  );
  expect(autoSave.save).not.toHaveBeenCalled();
});

it("retries saving and blocks duplicate retries while saving", () => {
  const view = render(<RemotePipelineSaveRecovery />);
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  expect(autoSave.save).toHaveBeenCalledOnce();
  autoSave.isSaving = true;
  view.unmount();
  render(<RemotePipelineSaveRecovery />);
  expect(screen.getByRole("button", { name: "Retry save" })).toBeDisabled();
});
