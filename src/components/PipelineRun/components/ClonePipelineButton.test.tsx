import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/dom";
import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  TopNavActionsProvider,
  TopNavActionsRenderer,
} from "@/components/layout/TopNavActionsProvider";
import useToastNotification from "@/hooks/useToastNotification";
import * as ComponentSpecProvider from "@/providers/ComponentSpecProvider";
import * as ExecutionDataProvider from "@/providers/ExecutionDataProvider";
import * as pipelineRunService from "@/services/pipelineRunService";

import {
  ClonePipelineButton,
  ClonePipelineButtonTopNav,
} from "./ClonePipelineButton";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/hooks/useToastNotification");
vi.mock("@/services/pipelineRunService");

describe("<ClonePipelineButton/>", () => {
  const queryClient = new QueryClient();
  const mockNotify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.mocked(useToastNotification).mockReturnValue(mockNotify);
    vi.mocked(pipelineRunService.copyRunToPipeline).mockResolvedValue({
      url: "/editor/cloned-pipeline",
      name: "Cloned Pipeline",
    });
    vi.spyOn(ExecutionDataProvider, "useExecutionData").mockReturnValue({
      rootDetails: undefined,
    } as unknown as ReturnType<typeof ExecutionDataProvider.useExecutionData>);
  });

  const componentSpec = { name: "Test Pipeline" } as any;

  const renderWithClient = (component: React.ReactElement) =>
    render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );

  test("renders clone button", () => {
    renderWithClient(<ClonePipelineButton componentSpec={componentSpec} />);
    expect(
      screen.queryByTestId("clone-pipeline-run-button"),
    ).toBeInTheDocument();
  });

  test("calls copyRunToPipeline with task arguments and navigate on click", async () => {
    const mockTaskArguments = {
      input_param: "input_value",
      another_param: "another_value",
    };

    vi.spyOn(ExecutionDataProvider, "useExecutionData").mockReturnValue({
      rootDetails: {
        task_spec: {
          arguments: mockTaskArguments,
        },
      },
    } as unknown as ReturnType<typeof ExecutionDataProvider.useExecutionData>);

    renderWithClient(<ClonePipelineButton componentSpec={componentSpec} />);

    const cloneButton = screen.getByTestId("clone-pipeline-run-button");
    act(() => fireEvent.click(cloneButton));

    await waitFor(() => {
      expect(pipelineRunService.copyRunToPipeline).toHaveBeenCalledWith(
        componentSpec,
        undefined,
        expect.stringContaining("Test Pipeline"),
        mockTaskArguments,
      );
    });

    expect(mockNotify).toHaveBeenCalledWith(
      expect.stringContaining("cloned"),
      "success",
    );
  });
});

describe("<ClonePipelineButtonTopNav/>", () => {
  const queryClient = new QueryClient();
  const mockNotify = vi.fn();
  const mockComponentSpec = { name: "Test Pipeline" } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.mocked(useToastNotification).mockReturnValue(mockNotify);
    vi.mocked(pipelineRunService.copyRunToPipeline).mockResolvedValue({
      url: "/editor/cloned-pipeline",
      name: "Cloned Pipeline",
    });
    vi.spyOn(ComponentSpecProvider, "useComponentSpec").mockReturnValue({
      componentSpec: mockComponentSpec,
    } as unknown as ReturnType<typeof ComponentSpecProvider.useComponentSpec>);
    vi.spyOn(ExecutionDataProvider, "useExecutionData").mockReturnValue({
      runId: "run-123",
      rootDetails: undefined,
    } as unknown as ReturnType<typeof ExecutionDataProvider.useExecutionData>);
  });

  const renderWithProviders = (component: React.ReactElement) =>
    render(
      <QueryClientProvider client={queryClient}>
        <TopNavActionsProvider>
          {component}
          <TopNavActionsRenderer />
        </TopNavActionsProvider>
      </QueryClientProvider>,
    );

  test("registers clone button in top nav", () => {
    renderWithProviders(<ClonePipelineButtonTopNav />);
    expect(
      screen.queryByTestId("global-clone-pipeline-run-button"),
    ).toBeInTheDocument();
  });

  test("calls copyRunToPipeline with componentSpec and runId from context", async () => {
    const mockTaskArguments = {
      input_param: "input_value",
    };

    vi.spyOn(ExecutionDataProvider, "useExecutionData").mockReturnValue({
      runId: "run-456",
      rootDetails: {
        task_spec: {
          arguments: mockTaskArguments,
        },
      },
    } as unknown as ReturnType<typeof ExecutionDataProvider.useExecutionData>);

    renderWithProviders(<ClonePipelineButtonTopNav />);

    const cloneButton = screen.getByTestId("global-clone-pipeline-run-button");
    act(() => fireEvent.click(cloneButton));

    await waitFor(() => {
      expect(pipelineRunService.copyRunToPipeline).toHaveBeenCalledWith(
        mockComponentSpec,
        "run-456",
        expect.stringContaining("Test Pipeline"),
        mockTaskArguments,
      );
    });

    expect(mockNotify).toHaveBeenCalledWith(
      expect.stringContaining("cloned"),
      "success",
    );
  });
});
