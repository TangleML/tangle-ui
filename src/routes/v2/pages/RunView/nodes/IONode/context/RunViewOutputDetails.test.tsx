import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArtifactNodeResponse } from "@/api/types.gen";

import { RunViewOutputDetails } from "./RunViewOutputDetails";

const mockSpec = {
  outputs: [
    {
      $id: "out-1",
      name: "model",
      type: "String",
      description: "The trained model",
    },
  ],
};

let mockExecutionData: { rootExecutionId?: string } | null = {
  rootExecutionId: "root-exec-1",
};

vi.mock("@/routes/v2/shared/providers/SpecContext", () => ({
  useSpec: () => mockSpec,
}));

vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionDataOptional: () => mockExecutionData,
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "http://backend" }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/components/shared/Buttons/LinkNodeButton", () => ({
  LinkNodeButton: () => <button type="button">Link</button>,
}));

vi.mock(
  "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOCell/IOCell",
  () => ({
    default: ({
      name,
      type,
      artifact,
    }: {
      name: string;
      type?: string;
      artifact: ArtifactNodeResponse | null | undefined;
    }) => (
      <div
        data-testid="io-cell"
        data-name={name}
        data-type={type}
        data-artifact-id={artifact?.id ?? ""}
      />
    ),
  }),
);

const getExecutionArtifacts = vi.fn();
vi.mock("@/services/executionService", () => ({
  getExecutionArtifacts: (...args: unknown[]) => getExecutionArtifacts(...args),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderPanel = (ui: ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

beforeEach(() => {
  queryClient.clear();
  getExecutionArtifacts.mockReset();
  getExecutionArtifacts.mockResolvedValue({ output_artifacts: {} });
  mockExecutionData = { rootExecutionId: "root-exec-1" };
});

afterEach(cleanup);

describe("RunViewOutputDetails", () => {
  it("fetches root-execution artifacts and renders the matching output in IOCell", async () => {
    getExecutionArtifacts.mockResolvedValue({
      output_artifacts: {
        model: { id: "artifact-model" } as ArtifactNodeResponse,
      },
    });

    renderPanel(<RunViewOutputDetails entityId="out-1" />);

    await waitFor(() => {
      const cell = screen.getByTestId("io-cell");
      expect(cell).toHaveAttribute("data-name", "model");
      expect(cell).toHaveAttribute("data-type", "String");
      expect(cell).toHaveAttribute("data-artifact-id", "artifact-model");
    });

    expect(getExecutionArtifacts).toHaveBeenCalledWith(
      "root-exec-1",
      "http://backend",
    );
  });

  it("does not render the artifact preview when there is no execution", async () => {
    mockExecutionData = null;

    renderPanel(<RunViewOutputDetails entityId="out-1" />);

    expect(await screen.findByText("model")).toBeInTheDocument();
    expect(screen.queryByTestId("io-cell")).toBeNull();
    expect(screen.queryByText("Value")).toBeNull();
    expect(getExecutionArtifacts).not.toHaveBeenCalled();
  });

  it("shows a not-found message for an unknown output id", () => {
    renderPanel(<RunViewOutputDetails entityId="missing" />);

    expect(screen.getByText("Output not found")).toBeInTheDocument();
    expect(screen.queryByTestId("io-cell")).toBeNull();
  });
});
