import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/dom";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import * as pipelineRunService from "@/services/pipelineRunService";

import { CancelPipelineRunButton } from "./CancelPipelineRunButton";

// Mock the services and hooks
vi.mock("@/services/pipelineRunService");
vi.mock("@/hooks/useToastNotification");
vi.mock("@/providers/BackendProvider");

describe("<CancelPipelineRunButton/>", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const mockNotify: ReturnType<typeof vi.fn> = vi.fn();

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    vi.mocked(useToastNotification).mockReturnValue(mockNotify);

    vi.mocked(useBackend).mockReturnValue({
      configured: true,
      available: true,
      ready: true,
      backendUrl: "http://localhost:8000",
      isConfiguredFromEnv: false,
      isConfiguredFromRelativePath: false,
      setEnvConfig: vi.fn(),
      setRelativePathConfig: vi.fn(),
      setBackendUrl: vi.fn(),
      ping: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    return new Promise((resolve) => setTimeout(resolve, 0));
  });

  const renderWithQueryClient = (component: ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );
  };

  describe("Rendering", () => {
    test("renders cancel button with correct icon", () => {
      renderWithQueryClient(<CancelPipelineRunButton runId="test-run-123" />);

      const button = screen.getByTestId("cancel-pipeline-run-button");
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
      expect(button).toHaveClass("bg-destructive");
    });

    test("renders button when runId is null", () => {
      renderWithQueryClient(<CancelPipelineRunButton runId={null} />);

      const button = screen.getByTestId("cancel-pipeline-run-button");
      expect(button).toBeDefined();
    });
  });

  describe("Confirmation Dialog", () => {
    test("opens confirmation dialog when button is clicked", async () => {
      // arrange
      renderWithQueryClient(<CancelPipelineRunButton runId="test-run-123" />);
      const button = screen.getByTestId("cancel-pipeline-run-button");

      // act
      await act(() => fireEvent.click(button));

      // assert
      expect(screen.getByRole("heading", { name: "Cancel run" })).toBeDefined();
      expect(
        screen.getByText(
          "The run will be scheduled for cancellation. This action cannot be undone.",
        ),
      ).toBeDefined();
    });

    test("closes confirmation dialog when cancel is clicked", async () => {
      // arrange
      renderWithQueryClient(<CancelPipelineRunButton runId="test-run-123" />);
      const button = screen.getByTestId("cancel-pipeline-run-button");

      // act
      await act(() => fireEvent.click(button));
      expect(screen.getByRole("heading", { name: "Cancel run" })).toBeDefined();

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await act(() => fireEvent.click(cancelButton));

      // assert
      expect(screen.queryByRole("heading", { name: "Cancel run" })).toBeNull();
    });
  });

  describe("Pipeline Cancellation", () => {
    const cancelPipelineRun = vi.mocked(pipelineRunService.cancelPipelineRun);

    test("successfully cancels pipeline run", async () => {
      // arrange
      cancelPipelineRun.mockResolvedValue();
      renderWithQueryClient(<CancelPipelineRunButton runId="test-run-123" />);

      // act
      const button = screen.getByTestId("cancel-pipeline-run-button");
      await act(() => fireEvent.click(button));
      const confirmButton = screen.getByText("Continue");
      await act(() => fireEvent.click(confirmButton));

      // assert
      expect(cancelPipelineRun).toHaveBeenCalledWith(
        "test-run-123",
        "http://localhost:8000",
      );
      expect(mockNotify).toHaveBeenCalledWith(
        "Pipeline run test-run-123 cancelled",
        "success",
      );
      expect(button).toBeDisabled();
    });

    test("handles cancellation error", async () => {
      // arrange
      const errorMessage = "Network error";
      cancelPipelineRun.mockRejectedValue(new Error(errorMessage));
      renderWithQueryClient(<CancelPipelineRunButton runId="test-run-123" />);

      // act
      const button = screen.getByTestId("cancel-pipeline-run-button");
      await act(() => fireEvent.click(button));
      const confirmButton = screen.getByText("Continue");
      await act(() => fireEvent.click(confirmButton));

      // assert
      expect(mockNotify).toHaveBeenCalledWith(
        `Error cancelling run: Error: ${errorMessage}`,
        "error",
      );
      expect(button).toBeVisible();
    });

    test("shows warning when runId is null", async () => {
      // arrange
      renderWithQueryClient(<CancelPipelineRunButton runId={null} />);

      // act
      const button = screen.getByTestId("cancel-pipeline-run-button");
      await act(() => fireEvent.click(button));
      const confirmButton = screen.getByText("Continue");
      await act(() => fireEvent.click(confirmButton));

      // assert
      expect(mockNotify).toHaveBeenCalledWith(
        "Failed to cancel run. No run ID found.",
        "warning",
      );
      expect(cancelPipelineRun).not.toHaveBeenCalled();
    });

    test("shows loading state during cancellation", async () => {
      // arrange
      let resolvePromise: () => void;
      const pendingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      cancelPipelineRun.mockReturnValue(pendingPromise);

      renderWithQueryClient(<CancelPipelineRunButton runId="test-run-123" />);

      // act
      const button = screen.getByTestId("cancel-pipeline-run-button");
      await act(() => fireEvent.click(button));
      const confirmButton = screen.getByText("Continue");
      await act(() => fireEvent.click(confirmButton));

      // assert
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("");

      // Resolve the promise
      resolvePromise!();

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          "Pipeline run test-run-123 cancelled",
          "success",
        );
      });
    });
  });
});
