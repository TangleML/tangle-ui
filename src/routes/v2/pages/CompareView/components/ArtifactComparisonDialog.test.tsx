import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ArtifactNodeResponse } from "@/api/types.gen";

import { ArtifactComparisonDialog } from "./ArtifactComparisonDialog";

vi.mock(
  "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOCell/ArtifactVisualizer/ArtifactPreviewContent",
  () => ({
    PreviewContent: ({
      artifactId,
      totalSize,
    }: {
      artifactId: string;
      totalSize?: number;
    }) => (
      <div
        data-testid="preview-content"
        data-artifact-id={artifactId}
        data-total-size={totalSize}
      />
    ),
    PreviewSkeleton: () => null,
  }),
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const artifact = (
  id: string,
  artifactData?: ArtifactNodeResponse["artifact_data"],
): ArtifactNodeResponse => ({ id, artifact_data: artifactData });

const renderDialog = (
  artifactA: ArtifactNodeResponse,
  artifactB: ArtifactNodeResponse,
) =>
  render(
    <QueryClientProvider client={queryClient}>
      <ArtifactComparisonDialog
        open
        onOpenChange={() => {}}
        name="table"
        labelA="run-a"
        labelB="run-b"
        artifactA={artifactA}
        artifactB={artifactB}
        typeA="Apache Parquet"
        typeB="Apache Parquet"
      />
    </QueryClientProvider>,
  );

describe("ArtifactComparisonDialog", () => {
  it("passes each side's reported size to its preview", () => {
    renderDialog(
      artifact("a1", { total_size: 1024, is_dir: false }),
      artifact("b1", { total_size: 9446073, is_dir: false }),
    );

    const [paneA, paneB] = screen.getAllByTestId("preview-content");
    expect(paneA).toHaveAttribute("data-artifact-id", "a1");
    expect(paneA).toHaveAttribute("data-total-size", "1024");
    expect(paneB).toHaveAttribute("data-artifact-id", "b1");
    expect(paneB).toHaveAttribute("data-total-size", "9446073");
  });

  it("omits the size when a side reports no artifact data", () => {
    renderDialog(
      artifact("a1"),
      artifact("b1", { total_size: 1024, is_dir: false }),
    );

    const [paneA, paneB] = screen.getAllByTestId("preview-content");
    expect(paneA).not.toHaveAttribute("data-total-size");
    expect(paneB).toHaveAttribute("data-total-size", "1024");
  });
});
