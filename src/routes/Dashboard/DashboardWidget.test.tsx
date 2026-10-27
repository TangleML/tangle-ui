import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getDefaultEditorPath,
  getDefaultRemoteEditorPath,
} from "@/routes/editorRoutes";
import { formatDate } from "@/utils/date";

import { DashboardWidget } from "./DashboardWidget";

const { pipelines, localNames, toggleFavorite, navigate } = vi.hoisted(() => ({
  pipelines: [
    {
      id: "pipeline-1",
      pipeline_name: "Training pipeline",
      file_path: "Training pipeline",
      user_id: "user@example.com",
      created_at: "2026-10-20T12:00:00Z",
      updated_at: "2026-10-21T14:00:00Z",
      current_version: "version-1",
    },
  ],
  localNames: ["Local pipeline"],
  toggleFavorite: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "https://backend.example.com",
    configured: true,
    available: true,
    ready: true,
  }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/services/pipelineStorage/pipelineCreation", () => ({
  remotePipelinesEnabled: () => true,
}));

vi.mock("@/services/localPipelines/useLocalPipelines", () => ({
  useLocalPipelineNames: () => ({ data: localNames, isLoading: false }),
}));

vi.mock("@/hooks/useRemotePipelinesPage", () => ({
  useRemotePipelinesPage: () => ({
    data: { pipelines },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useFavorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite }),
}));

function renderPipelines(width: 1 | 2 | 3 = 3) {
  return render(
    <DashboardWidget
      section={{ id: "pipelines", type: "pipelines", width }}
      editing={false}
      onChange={vi.fn()}
      onRemove={vi.fn()}
      onMove={vi.fn()}
      first
      last
    />,
  );
}

describe("dashboard pipelines", () => {
  afterEach(() => vi.clearAllMocks());

  it.each([1, 2] as const)("omits pipeline headers at width %s", (width) => {
    renderPipelines(width);
    const table = screen.getByRole("table", { name: "My Pipelines" });
    expect(within(table).queryByRole("columnheader")).not.toBeInTheDocument();
    expect(
      within(table).getByRole("link", { name: "Training pipeline" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("link", { name: "Local pipeline" }),
    ).toBeInTheDocument();
  });

  it("aligns remote pipeline metadata with the pipeline headers and retains favorites", async () => {
    const user = userEvent.setup();
    renderPipelines();
    const table = screen.getByRole("table", { name: "My Pipelines" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      "Name",
      "ID",
      "User",
      "Created at",
      "Updated at",
      "Current version",
      "Actions",
    ]);
    const row = within(table).getAllByRole("row")[1];
    const cells = within(row).getAllByRole("cell");
    expect(cells.slice(0, 6).map((cell) => cell.textContent)).toEqual([
      "Training pipeline",
      "pipeline-1",
      "user@example.com",
      formatDate(pipelines[0].created_at),
      formatDate(pipelines[0].updated_at),
      "version-1",
    ]);
    expect(
      within(row).getByRole("link", { name: "Training pipeline" }),
    ).toHaveAttribute("href", getDefaultRemoteEditorPath("pipeline-1"));
    expect(
      within(row).getByRole("button", { name: "Copy pipeline ID" }),
    ).toBeInTheDocument();
    await user.click(
      within(row).getByRole("button", {
        name: "Add Training pipeline to favorites",
      }),
    );
    expect(toggleFavorite).toHaveBeenCalledWith({
      type: "remote-pipeline",
      id: "pipeline-1",
      name: "Training pipeline",
    });
    expect(navigate).not.toHaveBeenCalled();
    await user.click(cells[4]);
    expect(navigate).toHaveBeenCalledWith({
      to: getDefaultRemoteEditorPath("pipeline-1"),
    });
  });

  it("keeps local pipelines navigable without inventing remote metadata", () => {
    renderPipelines();
    const link = screen.getByRole("link", { name: "Local pipeline" });
    expect(link).toHaveAttribute(
      "href",
      getDefaultEditorPath("Local pipeline"),
    );
    const row = link.closest("tr")!;
    expect(
      within(row)
        .getAllByRole("cell")
        .slice(1, 6)
        .map((cell) => cell.textContent),
    ).toEqual(["—", "—", "—", "Local pipeline", "—"]);
    expect(
      within(row).queryByRole("button", { name: "Copy pipeline ID" }),
    ).not.toBeInTheDocument();
  });
});
