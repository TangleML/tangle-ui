import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRemotePipelinesPage } from "@/hooks/useRemotePipelinesPage";
import { pipelinePickerQuery } from "@/routes/v2/pages/Tangent/services/pipelinePickerQuery";
import { remotePipelineResourceInput } from "@/services/projects/pipelineResource";
import type { RemotePipeline } from "@/services/remotePipelinesService";

import { RemotePipelinePicker } from "./RemotePipelinePicker";

const BACKEND_URL = "https://backend.example";
const ID = "71c26504-e061-4edb-a2f8-846bc960f8b2";

const backend = {
  backendUrl: BACKEND_URL,
  configured: true,
  available: true,
  ready: true,
};

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

vi.mock("@/hooks/useRemotePipelinesPage", () => ({
  useRemotePipelinesPage: vi.fn(),
}));

const TAXI: RemotePipeline = {
  id: ID,
  user_id: "ada@example.com",
  file_path: "pipelines/taxi.yaml",
  pipeline_name: "Chicago Taxi Trips query",
  created_at: "2026-10-27T10:00:00Z",
  updated_at: "2026-10-28T10:00:00Z",
  current_version: "sha256:taxi",
  versioning_mode: "disabled",
};

function listPipelines(pipelines: RemotePipeline[]) {
  vi.mocked(useRemotePipelinesPage).mockReturnValue({
    data: { pipelines, nextPageToken: null },
    isLoading: false,
    isFetching: false,
    error: null,
  } as unknown as ReturnType<typeof useRemotePipelinesPage>);
}

function lastQuery() {
  return vi.mocked(useRemotePipelinesPage).mock.lastCall?.[3];
}

function renderPicker() {
  const onChoose = vi.fn();
  render(<RemotePipelinePicker onChoose={onChoose} />);
  return { onChoose, user: userEvent.setup() };
}

describe("RemotePipelinePicker", () => {
  beforeEach(() => listPipelines([TAXI]));
  afterEach(() => vi.resetAllMocks());

  it("lists the caller's saved pipelines by default", () => {
    renderPicker();

    expect(
      screen.getByRole("switch", { name: "Only my pipelines" }),
    ).toBeChecked();
    expect(useRemotePipelinesPage).toHaveBeenLastCalledWith(
      BACKEND_URL,
      undefined,
      true,
      pipelinePickerQuery("", true),
    );
    expect(screen.getByText(ID)).toBeInTheDocument();
  });

  it("lists everyone's pipelines once the toggle is off", async () => {
    const { user } = renderPicker();

    await user.click(screen.getByRole("switch", { name: "Only my pipelines" }));

    expect(lastQuery()).toBeUndefined();
  });

  it("searches by ID when a complete ID is typed, and by name otherwise", async () => {
    const { user } = renderPicker();
    const search = screen.getByRole("textbox", {
      name: "Search by name or ID",
    });

    await user.type(search, "taxi");
    await waitFor(() =>
      expect(lastQuery()).toBe(pipelinePickerQuery("taxi", true)),
    );

    await user.clear(search);
    await user.type(search, ID);
    await waitFor(() =>
      expect(lastQuery()).toBe(pipelinePickerQuery(ID, true)),
    );
  });

  it("attaches the chosen pipeline by its saved ID", async () => {
    const { onChoose, user } = renderPicker();

    await user.click(
      screen.getByRole("button", { name: "Chicago Taxi Trips query" }),
    );

    expect(onChoose).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledWith(
      remotePipelineResourceInput(ID, "Chicago Taxi Trips query"),
    );
  });

  it("says when a search matches nothing", async () => {
    listPipelines([]);
    const { user } = renderPicker();

    await user.type(
      screen.getByRole("textbox", { name: "Search by name or ID" }),
      "missing",
    );

    expect(
      await screen.findByText('No pipelines match "missing".'),
    ).toBeInTheDocument();
  });
});
