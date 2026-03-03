import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ContainerExecutionStatus } from "@/api/types.gen";
import { useBackend } from "@/providers/BackendProvider";

import { OpenLogsInNewWindowLink } from "../logs";

// Mock the BackendProvider
vi.mock("@/providers/BackendProvider");

describe("OpenLogsInNewWindowLink", () => {
  const defaultBackendUrl = "http://localhost:8000";

  const defaultBackend = {
    configured: true,
    available: true,
    ready: true,
    backendUrl: defaultBackendUrl,
    isConfiguredFromEnv: false,
    isConfiguredFromRelativePath: false,
    setEnvConfig: vi.fn(),
    setRelativePathConfig: vi.fn(),
    setBackendUrl: vi.fn(),
    ping: vi.fn(),
  };
  const mockUseBackend = vi.mocked(useBackend);
  const testExecutionId = "test-execution-123";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default backend configuration
    mockUseBackend.mockReturnValue(defaultBackend);
  });

  test("returns null when executionId is not provided", () => {
    render(<OpenLogsInNewWindowLink executionId="" status="SUCCEEDED" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("renders link when executionId is provided and status should have logs", () => {
    render(
      <OpenLogsInNewWindowLink
        executionId={testExecutionId}
        status="SUCCEEDED"
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("Open in new tab");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("aria-label", "Open logs in a new tab");

    expect(link).toHaveAttribute(
      "href",
      `${defaultBackendUrl}/api/executions/${testExecutionId}/stream_container_log`,
    );
  });

  test("has correct accessible label when backend is not available", () => {
    mockUseBackend.mockReturnValue({
      ...defaultBackend,
      available: false,
    });

    render(
      <OpenLogsInNewWindowLink
        executionId={testExecutionId}
        status="SUCCEEDED"
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveClass("cursor-not-allowed");
    expect(link).toHaveClass("pointer-events-none");
    expect(link).toHaveAttribute(
      "aria-label",
      "Cant open logs: Backend not available",
    );
  });

  describe("different execution statuses", () => {
    const statusesThatShouldHaveLogs: ContainerExecutionStatus[] = [
      "RUNNING",
      "PENDING",
      "CANCELLING",
      "FAILED",
      "SYSTEM_ERROR",
      "SUCCEEDED",
      // CANCELLED may have logs when the task was cancelled mid-run; the
      // backend uploads logs before termination in that path.
      "CANCELLED",
    ];

    const statusesThatShouldNotHaveLogs: ContainerExecutionStatus[] = [
      "INVALID",
      "UNINITIALIZED",
      "QUEUED",
      "WAITING_FOR_UPSTREAM",
      "SKIPPED",
    ];

    test.each(statusesThatShouldHaveLogs)(
      "renders link for status: %s",
      (status) => {
        render(
          <OpenLogsInNewWindowLink
            executionId={testExecutionId}
            status={status}
          />,
        );

        const link = screen.getByRole("link");

        expect(link).toBeInTheDocument();
        expect(link).toHaveTextContent("Open in new tab");
      },
    );

    test.each(statusesThatShouldNotHaveLogs)(
      "returns null when should not have logs for status %s",
      (status) => {
        render(
          <OpenLogsInNewWindowLink
            executionId={testExecutionId}
            status={status}
          />,
        );

        expect(screen.queryByRole("link")).not.toBeInTheDocument();
      },
    );
  });
});
