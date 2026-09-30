import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import BulkActionsBar from "./BulkActionsBar";

const notify = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
vi.mock("@/services/pipelineService", () => ({ deletePipeline: vi.fn() }));
vi.mock("@/components/shared/FloatingSelectionBar", () => ({
  FloatingSelectionBar: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/shared/Dialogs", () => ({
  ConfirmationDialog: ({ onConfirm }: { onConfirm: () => Promise<void> }) => (
    <button type="button" onClick={() => void onConfirm()}>
      Confirm deletion
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("refreshes after every deletion settles when only some deletions succeed", async () => {
  let finishLocalDelete = () => {};
  const localDeletion = new Promise<void>((resolve) => {
    finishLocalDelete = resolve;
  });
  const onDeletePipeline = vi.fn((id: string) =>
    id === "local-id"
      ? localDeletion
      : Promise.reject(new Error("Server unavailable")),
  );
  const onDeleteSuccess = vi.fn();
  const onDeleteSettled = vi.fn();
  render(
    <BulkActionsBar
      selectedPipelines={["local-id", "remote-id"]}
      onDeletePipeline={onDeletePipeline}
      onDeleteSuccess={onDeleteSuccess}
      onDeleteSettled={onDeleteSettled}
      onClearSelection={vi.fn()}
    />,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
  });

  expect(onDeletePipeline.mock.calls).toEqual([["local-id"], ["remote-id"]]);
  expect(onDeleteSettled).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();

  await act(async () => finishLocalDelete());

  expect(onDeleteSettled).toHaveBeenCalledOnce();
  expect(onDeleteSuccess).not.toHaveBeenCalled();
  expect(notify).toHaveBeenCalledExactlyOnceWith(
    "Failed to delete some pipelines: Server unavailable",
    "error",
  );
});
