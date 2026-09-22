import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PipelineRows } from "@/routes/v2/pages/PipelineFolders/components/FolderPipelineTable/components/PipelineRows";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { remotePipelineReference } from "@/services/pipelineStorage/remotePipelineRecovery";
import type { PipelineRunFilters } from "@/types/pipelineRunFilters";

const BACKEND_URL = "https://backend.example";
const PIPELINE_ID = "47a95130-267f-4e41-9469-3a8f935f4ac3";
const mockNavigate = vi.fn();
const mockUsePipelineRuns = vi.fn((_pipelineName: string) => ({
  data: [] as unknown[],
}));
let mockBackendUrl = BACKEND_URL;

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({
    to,
    search,
    onClick,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    search: { filter: PipelineRunFilters };
  }) => (
    <a
      {...props}
      href={`${to}?${new URLSearchParams({ filter: JSON.stringify(search.filter) })}`}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    />
  ),
}));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: mockBackendUrl }),
}));
vi.mock("@/hooks/useFavorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}));
vi.mock("@/hooks/useSavePipelineToCloud", () => ({
  useSavePipelineToCloud: (file: PipelineFile) => ({
    isSupported: file.storageKind === "pending" || !!file.saveError,
    isRetry: true,
    isPending: false,
    save: vi.fn(),
  }),
}));
vi.mock("@/components/shared/Dialogs", () => ({
  ConfirmationDialog: ({ trigger }: { trigger: ReactNode }) => trigger,
}));
vi.mock("@/components/shared/PipelineRunDisplay/usePipelineRuns", () => ({
  usePipelineRuns: (pipelineName: string) => mockUsePipelineRuns(pipelineName),
}));
vi.mock("@/components/shared/PipelineRunDisplay/PipelineRunsList", () => ({
  PipelineRunsList: () => null,
}));
vi.mock(
  "@/components/shared/PipelineRunDisplay/PipelineRunInfoCondensed",
  () => ({ PipelineRunInfoCondensed: () => <span>Recent pipeline run</span> }),
);
vi.mock("@/services/pipelineService", () => ({ deletePipeline: vi.fn() }));
vi.mock("@/utils/annotations", () => ({
  getPipelineTagsFromSpec: () => [],
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockBackendUrl = BACKEND_URL;
  mockUsePipelineRuns.mockReturnValue({ data: [] });
});

afterEach(cleanup);

function renderPipeline(
  storageKind: PipelineFile["storageKind"],
  driverType = "root-indexdb",
  saveError?: string,
  canEdit = true,
  fileOverrides: Partial<PipelineFile> = {},
) {
  const file = {
    id: "pipeline-id",
    referenceId:
      storageKind === "remote"
        ? remotePipelineReference(BACKEND_URL, PIPELINE_ID)
        : "pipeline-reference",
    displayName: "Daily report",
    storageKind,
    saveError,
    canEdit,
    folder: { driver: { type: driverType } },
    ...fileOverrides,
  } as PipelineFile;

  return render(
    <table>
      <tbody>
        <PipelineRows
          pipelines={[file]}
          selectedPipelines={new Set()}
          draggingIds={new Set()}
          getDragItems={(item) => [item]}
          onSelectPipeline={vi.fn()}
          onDragStateChange={vi.fn()}
          onDelete={vi.fn()}
        />
      </tbody>
    </table>,
  );
}

describe("pipeline list storage labels", () => {
  it.each(["root-indexdb", "folder-indexdb"])(
    "uses one subtle Local badge for %s pipelines without a document icon",
    (driverType) => {
      const { container } = renderPipeline("local", driverType);

      expect(screen.getByText("Local")).toHaveClass("text-muted-foreground");
      expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(1);
      expect(
        container.querySelector(".lucide-file-spreadsheet"),
      ).not.toBeInTheDocument();
    },
  );

  it("leaves saved remote pipelines unlabelled and keeps favorites available", () => {
    const { container } = renderPipeline("remote");

    expect(screen.getByText("Daily report")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
    expect(screen.getByTestId("favorite-toggle")).toBeInTheDocument();
  });

  it.each(["local-fs", "google-drive"])(
    "does not label %s files as browser-local pipelines",
    (driverType) => {
      renderPipeline("local", driverType);
      expect(screen.queryByText("Local")).not.toBeInTheDocument();
    },
  );

  it.each(["pending", "remote"] as const)(
    "keeps unsaved %s pipelines visible with Retry",
    (storageKind) => {
      renderPipeline(storageKind, "remote", "Could not connect to server");

      if (storageKind === "pending") {
        expect(screen.getByText("Pending upload")).toBeInTheDocument();
      }
      expect(screen.getByText("Not saved to server")).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Retry save to server: Daily report",
        }),
      ).toBeEnabled();
      expect(screen.getByTestId("favorite-toggle")).toBeInTheDocument();
    },
  );
});

describe("pipeline row associated runs", () => {
  it("links a remote pipeline to its saved ID without requesting per-row runs", () => {
    renderPipeline("remote");

    const link = screen.getByRole("link", {
      name: "View runs for Daily report",
    });
    const url = new URL(link.getAttribute("href")!, window.location.origin);
    expect(url.pathname).toBe("/runs");
    expect(JSON.parse(url.searchParams.get("filter")!)).toEqual({
      saved_pipeline_id: PIPELINE_ID,
    });
    expect(mockUsePipelineRuns).not.toHaveBeenCalled();
    expect(screen.queryByText("Recent pipeline run")).not.toBeInTheDocument();

    fireEvent.click(link);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps same-name remote pipelines separate and follows renamed pipeline identity", () => {
    const cloneId = "bbc177cf-e1aa-48e0-898b-9dcd5e61c719";
    renderPipeline("remote");
    renderPipeline("remote", "remote", undefined, true, {
      referenceId: remotePipelineReference(BACKEND_URL, cloneId),
    });
    renderPipeline("remote", "remote", undefined, true, {
      displayName: "Renamed report",
    });

    const sameNameLinks = screen.getAllByRole("link", {
      name: "View runs for Daily report",
    });
    const renamedLink = screen.getByRole("link", {
      name: "View runs for Renamed report",
    });
    const savedId = (link: HTMLElement) => {
      const url = new URL(link.getAttribute("href")!, window.location.origin);
      return JSON.parse(url.searchParams.get("filter")!).saved_pipeline_id;
    };

    expect(sameNameLinks.map(savedId)).toEqual([PIPELINE_ID, cloneId]);
    expect(savedId(renamedLink)).toBe(PIPELINE_ID);
    expect(mockUsePipelineRuns).not.toHaveBeenCalled();
  });

  it("accepts a configured backend with a trailing slash", () => {
    mockBackendUrl = `${BACKEND_URL}/`;
    renderPipeline("remote");

    expect(
      screen.getByRole("link", { name: "View runs for Daily report" }),
    ).toBeVisible();
  });

  it.each([
    "invalid-reference",
    remotePipelineReference(BACKEND_URL, "invalid-id"),
    remotePipelineReference("https://other.example", PIPELINE_ID),
  ])(
    "does not associate a remote row with an invalid or foreign reference: %s",
    (referenceId) => {
      renderPipeline("remote", "remote", undefined, true, { referenceId });

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(mockUsePipelineRuns).not.toHaveBeenCalled();
      expect(screen.queryByText("Recent pipeline run")).not.toBeInTheDocument();
    },
  );

  it("preserves recent-run and run-list behavior for local pipelines", () => {
    mockUsePipelineRuns.mockReturnValue({ data: [{ id: "recent-run" }] });
    const { container } = renderPipeline("local");

    expect(mockUsePipelineRuns).toHaveBeenCalledWith("Daily report");
    expect(screen.getByText("Recent pipeline run")).toBeVisible();
    expect(container.querySelector("[data-popover-trigger]")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps local files local when their names look like remote references", () => {
    renderPipeline("local", "root-indexdb", undefined, true, {
      referenceId: remotePipelineReference(BACKEND_URL, PIPELINE_ID),
    });

    expect(mockUsePipelineRuns).toHaveBeenCalledWith("Daily report");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("pipeline row actions", () => {
  it.each(["local", "remote", "pending"] as const)(
    "reserves the same three action slots for %s pipelines",
    (storageKind) => {
      renderPipeline(storageKind);

      const favorite = screen.getByTestId("favorite-toggle");
      const actions = favorite.parentElement!.parentElement!;
      expect(actions).toHaveClass("grid", "grid-cols-3");
      expect(actions.children).toHaveLength(3);
      for (const slot of actions.children) {
        expect(slot).toHaveClass("size-9");
      }
      expect(actions.children[1]).toContainElement(favorite);
      const trash = screen.getByRole("button", {
        name: "Delete pipeline: Daily report",
      });
      expect(actions.children[2]).toContainElement(trash);
      expect(trash).toBeVisible();
      expect(trash).toHaveClass(
        "text-muted-foreground",
        "hover:text-destructive-foreground",
      );
      expect(trash).not.toHaveClass("opacity-0");
      if (storageKind === "pending") {
        expect(actions.children[0]).toContainElement(
          screen.getByTestId("save-pipeline-to-cloud"),
        );
      } else {
        expect(actions.children[0]).toBeEmptyDOMElement();
      }
    },
  );

  it("keeps the delete slot empty for read-only pipelines", () => {
    renderPipeline("remote", "remote", undefined, false);

    const actions =
      screen.getByTestId("favorite-toggle").parentElement!.parentElement!;
    expect(actions.children[2]).toHaveClass("size-9");
    expect(actions.children[2]).toBeEmptyDOMElement();
    expect(
      screen.queryByRole("button", { name: "Delete pipeline: Daily report" }),
    ).not.toBeInTheDocument();
  });
});
