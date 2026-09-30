import { cleanup, render, screen } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PipelineRows } from "@/routes/v2/pages/PipelineFolders/components/FolderPipelineTable/components/PipelineRows";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));
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
  usePipelineRuns: () => ({ data: [] }),
}));
vi.mock("@/components/shared/PipelineRunDisplay/PipelineRunsList", () => ({
  PipelineRunsList: () => null,
}));
vi.mock(
  "@/components/shared/PipelineRunDisplay/PipelineRunInfoCondensed",
  () => ({ PipelineRunInfoCondensed: () => null }),
);
vi.mock("@/services/pipelineService", () => ({ deletePipeline: vi.fn() }));
vi.mock("@/utils/annotations", () => ({
  getPipelineTagsFromSpec: () => [],
}));

afterEach(cleanup);

function renderPipeline(
  storageKind: PipelineFile["storageKind"],
  driverType = "root-indexdb",
  saveError?: string,
  canEdit = true,
) {
  const file = {
    id: "pipeline-id",
    referenceId: "pipeline-reference",
    displayName: "Daily report",
    storageKind,
    saveError,
    canEdit,
    folder: { driver: { type: driverType } },
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
