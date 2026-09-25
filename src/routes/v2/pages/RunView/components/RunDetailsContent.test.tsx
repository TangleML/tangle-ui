import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Annotations } from "@/models/componentSpec/annotations";

import { RunDetailsContent } from "./RunDetailsContent";

const mockSpec = {
  name: "Giphy",
  description: undefined,
  annotations: Annotations.from([]),
};

const mockMetadata = {
  id: "run-1",
  root_execution_id: "execution-1",
  created_by: "user-1",
  created_at: "2026-09-23T16:31:50.000Z",
};

const fetchRunAnnotations = vi.fn();

vi.mock("@/routes/v2/shared/providers/SpecContext", () => ({
  useSpec: () => mockSpec,
}));

vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionData: () => ({
    rootDetails: { task_spec: { arguments: {} } },
    rootState: { child_execution_status_stats: {} },
    metadata: mockMetadata,
    isLoading: false,
    error: undefined,
  }),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "http://backend", configured: true }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/hooks/useUserDetails", () => ({
  useUserDetails: () => ({ data: { id: "user-1" } }),
}));

vi.mock("@/services/pipelineRunService", () => ({
  fetchRunAnnotations: (...args: unknown[]) => fetchRunAnnotations(...args),
  updateRunAnnotation: vi.fn(),
}));

vi.mock("@/components/shared/Execution/PipelineIO", () => ({
  default: () => <div data-testid="pipeline-io" />,
}));

vi.mock("./RunDetailsHeader", () => ({
  RunDetailsHeader: ({ pipelineName }: { pipelineName: string }) => (
    <div>{pipelineName}</div>
  ),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderPanel = (ui: ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

const openDetailsSection = async () => {
  fireEvent.click(screen.getByText("Details"));
  expect(await screen.findByText("Run Notes")).toBeInTheDocument();
};

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("<RunDetailsContent/>", () => {
  it("shows run annotations", async () => {
    fetchRunAnnotations.mockResolvedValue({
      experiment: "baseline",
      "cost-center": "research",
    });

    renderPanel(<RunDetailsContent />);
    await openDetailsSection();

    expect(await screen.findByText("Run Annotations")).toBeInTheDocument();
    expect(screen.getByText("experiment")).toBeInTheDocument();
    expect(screen.getByText("baseline")).toBeInTheDocument();
    expect(screen.getByText("cost-center")).toBeInTheDocument();
    expect(screen.getByText("research")).toBeInTheDocument();
  });

  it("hides run annotations that are surfaced elsewhere in the panel", async () => {
    fetchRunAnnotations.mockResolvedValue({
      notes: "Run notes",
      tags: "Demo,Secrets",
      source: "web-app",
    });

    renderPanel(<RunDetailsContent />);
    await openDetailsSection();

    expect(screen.queryByText("Run Annotations")).not.toBeInTheDocument();
  });
});
