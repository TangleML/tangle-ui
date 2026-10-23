import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import PipelineRow from "./PipelineRow";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/components/shared/Dialogs", async () => ({
  ConfirmationDialog: (
    await import("@/components/shared/Dialogs/ConfirmationDialog")
  ).default,
}));
vi.mock("@/components/shared/FavoriteToggle", () => ({
  FavoriteToggle: () => null,
}));
vi.mock(
  "@/components/shared/PipelineRunDisplay/PipelineRunInfoCondensed",
  () => ({
    PipelineRunInfoCondensed: () => null,
  }),
);
vi.mock("@/components/shared/PipelineRunDisplay/PipelineRunsList", () => ({
  PipelineRunsList: () => null,
}));
vi.mock("@/components/shared/PipelineRunDisplay/usePipelineRuns", () => ({
  usePipelineRuns: () => ({ data: [] }),
}));
vi.mock("@/components/shared/SuspenseWrapper", () => ({
  withSuspenseWrapper: <T extends object>(Component: ComponentType<T>) =>
    Component,
}));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));
vi.mock("@/services/pipelineService", () => ({ deletePipeline: vi.fn() }));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function renderRow(onUpload: () => void, disabled = false) {
  return render(
    <table>
      <tbody>
        <PipelineRow
          name="Example"
          onSaveAsRemote={onUpload}
          saveAsRemoteDisabled={disabled}
        />
      </tbody>
    </table>,
  );
}

it("delegates upload to the pipeline list", () => {
  const upload = vi.fn();
  renderRow(upload);

  fireEvent.click(screen.getByRole("button", { name: "Upload pipeline" }));
  expect(upload).toHaveBeenCalledOnce();
});

it("does not upload when the action is disabled", () => {
  const upload = vi.fn();
  renderRow(upload, true);
  expect(
    screen.getByRole("button", { name: "Upload pipeline" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Upload pipeline" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(upload).not.toHaveBeenCalled();
});
