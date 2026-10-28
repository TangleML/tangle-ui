import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLocalPipelineNames } from "@/services/localPipelines/useLocalPipelines";
import { remotePipelinesEnabled } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineRef } from "@/services/pipelineStorage/types";
import { remotePipelineResourceInput } from "@/services/projects/pipelineResource";
import { localPipelineResourceInput } from "@/services/projects/resourceDescriptor";
import type { CreateResourceInput } from "@/services/projects/types";

import { AddPipelineDialog } from "./AddPipelineDialog";

const REMOTE_PICK = remotePipelineResourceInput(
  "71c26504-e061-4edb-a2f8-846bc960f8b2",
  "Chicago Taxi Trips query",
);
const LOCAL_PICK: PipelineRef = { name: "Churn model", fileId: "file-1" };

const backend = vi.hoisted(() => ({ ready: true, configured: true }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

vi.mock("@/services/pipelineStorage/pipelineCreation", () => ({
  remotePipelinesEnabled: vi.fn(),
}));

vi.mock("@/services/localPipelines/useLocalPipelines", () => ({
  useLocalPipelineNames: vi.fn(),
}));

// The folder browser reaches the whole editor tree, which does not survive
// being imported on its own.
vi.mock("@/routes/v2/pages/PipelineFolders/PipelineFolders", () => ({
  PipelineFolders: ({
    onPipelineClick,
  }: {
    onPipelineClick: (pipeline: PipelineRef) => void;
  }) => (
    <button type="button" onClick={() => onPipelineClick(LOCAL_PICK)}>
      Local pipeline
    </button>
  ),
}));

vi.mock("./RemotePipelinePicker", () => ({
  RemotePipelinePicker: ({
    onChoose,
  }: {
    onChoose: (resource: CreateResourceInput) => void;
  }) => (
    <button type="button" onClick={() => onChoose(REMOTE_PICK)}>
      Remote pipeline
    </button>
  ),
}));

function localPipelinesAre(names: string[] | undefined) {
  vi.mocked(useLocalPipelineNames).mockReturnValue({
    data: names,
    isPending: names === undefined,
  } as unknown as ReturnType<typeof useLocalPipelineNames>);
}

function renderDialog() {
  const close = vi.fn();
  render(<AddPipelineDialog close={close} cancel={vi.fn()} />, {
    wrapper: ({ children }) => (
      <Dialog open>
        <DialogContent>{children}</DialogContent>
      </Dialog>
    ),
  });
  return { close, user: userEvent.setup() };
}

describe("AddPipelineDialog", () => {
  beforeEach(() => {
    vi.mocked(remotePipelinesEnabled).mockReturnValue(true);
    localPipelinesAre(["Churn model"]);
  });

  afterEach(() => {
    vi.resetAllMocks();
    backend.ready = true;
    backend.configured = true;
  });

  it("opens on remote pipelines when this browser also has local ones", () => {
    renderDialog();

    expect(
      screen.getByRole("tab", { name: "Remote Pipelines" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("button", { name: "Remote pipeline" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Local pipeline" }),
    ).not.toBeInTheDocument();
  });

  it("attaches a remote pipeline by its saved ID", async () => {
    const { close, user } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Remote pipeline" }));

    expect(close).toHaveBeenCalledWith(REMOTE_PICK);
  });

  it("attaches a local pipeline from the Local Pipelines tab", async () => {
    const { close, user } = renderDialog();

    await user.click(screen.getByRole("tab", { name: "Local Pipelines" }));
    await user.click(screen.getByRole("button", { name: "Local pipeline" }));

    expect(close).toHaveBeenCalledWith(
      localPipelineResourceInput({
        localName: "Churn model",
        localId: "file-1",
      }),
    );
  });

  it("drops the tabs when this browser has no local pipelines", () => {
    localPipelinesAre([]);
    renderDialog();

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remote pipeline" }),
    ).toBeInTheDocument();
  });

  it("offers only local pipelines when remote pipelines are off", () => {
    vi.mocked(remotePipelinesEnabled).mockReturnValue(false);
    renderDialog();

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Local pipeline" }),
    ).toBeInTheDocument();
  });

  it("offers only local pipelines when no backend is configured", () => {
    backend.configured = false;
    renderDialog();

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Local pipeline" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["the backend settings", () => (backend.ready = false)],
    ["the local pipeline list", () => localPipelinesAre(undefined)],
  ])("waits for %s before choosing what to offer", (_, pending) => {
    pending();
    renderDialog();

    expect(screen.getByRole("status")).toHaveTextContent("Loading pipelines…");
    expect(
      screen.queryByRole("button", { name: /pipeline$/ }),
    ).not.toBeInTheDocument();
  });
});
