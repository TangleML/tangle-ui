import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/dom";
import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import useToastNotification from "@/hooks/useToastNotification";
import * as ExecutionDataProvider from "@/providers/ExecutionDataProvider";
import * as pipelineRunService from "@/services/pipelineRunService";

import { ClonePipelineButton } from "./ClonePipelineButton";

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

    vi.spyOn(ExecutionDataProvider, "useExecutionDataOptional").mockReturnValue(
      {
        rootDetails: {
          task_spec: {
            arguments: mockTaskArguments,
          },
        },
      } as unknown as ReturnType<
        typeof ExecutionDataProvider.useExecutionDataOptional
      >,
    );

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
