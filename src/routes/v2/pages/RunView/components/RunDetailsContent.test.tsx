import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import {
  SAVED_PIPELINE_ID_ANNOTATION,
  SOURCE_PIPELINE_ID_ANNOTATION,
} from "@/utils/pipelineRunSource";

import { RunDetailsContent } from "./RunDetailsContent";

const mocks = vi.hoisted(() => ({
  backendUrl: "https://backend.example.com",
  remotePipelinesEnabled: true,
  fetchRunAnnotations: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  Link: ({
    to,
    ...props
  }: Omit<ComponentProps<"a">, "href"> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ configured: true, backendUrl: mocks.backendUrl }),
}));

vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionData: () => ({
    rootDetails: { task_spec: { arguments: {} } },
    rootState: { child_execution_status_stats: {} },
    metadata: { id: "run-1", root_execution_id: "execution-1" },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useUserDetails", () => ({
  useUserDetails: () => ({ data: { id: "user-1" } }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/utils/remotePipelines", () => ({
  get REMOTE_PIPELINES_ENABLED() {
    return mocks.remotePipelinesEnabled;
  },
}));

vi.mock("@/services/pipelineRunService", () => ({
  fetchRunAnnotations: mocks.fetchRunAnnotations,
}));

vi.mock("./RunDetailsHeader", () => ({
  RunDetailsHeader: () => null,
}));

describe("RunDetailsContent source pipeline", () => {
  const sourcePipelineId = "550e8400-e29b-41d4-a716-446655440000";
  const otherPipelineId = "550e8400-e29b-41d4-a716-446655440001";
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.backendUrl = "https://backend.example.com";
    mocks.remotePipelinesEnabled = true;
    mocks.fetchRunAnnotations.mockResolvedValue({});
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  function renderDetails() {
    const spec = new ComponentSpec({ name: "Test pipeline" });
    return render(<RunDetailsContent />, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          <SpecProvider spec={spec}>{children}</SpecProvider>
        </QueryClientProvider>
      ),
    });
  }

  test.each([SAVED_PIPELINE_ID_ANNOTATION, SOURCE_PIPELINE_ID_ANNOTATION])(
    "links to the current editor using %s",
    async (annotationKey) => {
      mocks.fetchRunAnnotations.mockResolvedValue({
        [annotationKey]: sourcePipelineId,
      });

      renderDetails();

      const link = await screen.findByRole("link", { name: "Open pipeline" });
      expect(link).toHaveAttribute("href", `/editor-v2/${sourcePipelineId}`);
      expect(link).toHaveAttribute("title", sourcePipelineId);
      expect(link).not.toHaveAttribute("target");
      expect(screen.queryByText(sourcePipelineId)).not.toBeInTheDocument();
      expect(screen.getByText("Source pipeline")).toBeInTheDocument();
      expect(mocks.fetchRunAnnotations).toHaveBeenCalledExactlyOnceWith(
        "run-1",
        mocks.backendUrl,
      );
    },
  );

  test.each([undefined, "not-a-pipeline-id", ""])(
    "omits the backlink for source ID %s",
    (sourceId) => {
      queryClient.setQueryData(
        ["pipeline-run-annotations", mocks.backendUrl, "run-1"],
        sourceId === undefined
          ? {}
          : { [SOURCE_PIPELINE_ID_ANNOTATION]: sourceId },
      );

      renderDetails();

      expect(screen.getByText("Run Id")).toBeInTheDocument();
      expect(screen.queryByText("Source pipeline")).not.toBeInTheDocument();
    },
  );

  test("hides the backlink when remote pipelines are disabled", () => {
    mocks.remotePipelinesEnabled = false;
    queryClient.setQueryData(
      ["pipeline-run-annotations", mocks.backendUrl, "run-1"],
      { [SOURCE_PIPELINE_ID_ANNOTATION]: sourcePipelineId },
    );

    renderDetails();

    expect(screen.queryByText("Source pipeline")).not.toBeInTheDocument();
  });

  test("uses annotations from the selected backend", () => {
    queryClient.setQueryData(
      ["pipeline-run-annotations", mocks.backendUrl, "run-1"],
      { [SOURCE_PIPELINE_ID_ANNOTATION]: sourcePipelineId },
    );
    queryClient.setQueryData(
      ["pipeline-run-annotations", "https://other.example.com", "run-1"],
      { [SOURCE_PIPELINE_ID_ANNOTATION]: otherPipelineId },
    );

    const view = renderDetails();
    expect(screen.getByRole("link", { name: "Open pipeline" })).toHaveAttribute(
      "href",
      `/editor-v2/${sourcePipelineId}`,
    );

    view.unmount();
    mocks.backendUrl = "https://other.example.com";
    renderDetails();

    expect(screen.getByRole("link", { name: "Open pipeline" })).toHaveAttribute(
      "href",
      `/editor-v2/${otherPipelineId}`,
    );
    expect(screen.getByRole("link", { name: "Open pipeline" })).toHaveAttribute(
      "title",
      otherPipelineId,
    );
  });
});
