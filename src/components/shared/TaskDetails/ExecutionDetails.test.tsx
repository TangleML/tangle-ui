import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ExecutionDetails } from "./ExecutionDetails";

const { mockUseFetchContainerExecutionState } = vi.hoisted(() => ({
  mockUseFetchContainerExecutionState: vi.fn(),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "http://localhost:8000" }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/hooks/useLauncherCapabilities", () => ({
  useLauncherAnnotationSchema: () => ({
    schema: {},
    capabilitiesActive: false,
  }),
}));

vi.mock("@/services/executionService", () => ({
  useFetchContainerExecutionState: mockUseFetchContainerExecutionState,
}));

const JOB_URL = "https://example.com/jobs/job-123";

function renderWithDebugInfo(debugInfo: Record<string, unknown>) {
  mockUseFetchContainerExecutionState.mockReturnValue({
    data: { status: "RUNNING", debug_info: debugInfo },
    isLoading: false,
    error: null,
  });
  render(<ExecutionDetails executionId="exec-1" />);
}

describe("ExecutionDetails external links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders a link the backend put in debug_info", () => {
    renderWithDebugInfo({
      external_links: [
        { label: "Job dashboard", url_text: "job-123", url: JOB_URL },
      ],
    });

    expect(screen.getByText("Job dashboard")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "job-123" })).toHaveAttribute(
      "href",
      JOB_URL,
    );
  });

  test("uses the URL as the link text when url_text is missing", () => {
    renderWithDebugInfo({
      external_links: [{ label: "Job dashboard", url: JOB_URL }],
    });

    expect(screen.getByRole("link", { name: JOB_URL })).toHaveAttribute(
      "href",
      JOB_URL,
    );
  });

  test.each([["javascript:alert(1)"], ["/jobs/job-123"], [42], [undefined]])(
    "drops a link whose url is %s",
    (url) => {
      renderWithDebugInfo({
        external_links: [{ label: "Job dashboard", url_text: "job-123", url }],
      });

      expect(screen.queryByText("Job dashboard")).not.toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    },
  );

  test.each([[""], ["   "], [undefined]])(
    "drops a link whose label is %j",
    (label) => {
      renderWithDebugInfo({
        external_links: [{ label, url_text: "job-123", url: JOB_URL }],
      });

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    },
  );

  test("ignores external_links that is not an array", () => {
    renderWithDebugInfo({
      external_links: { label: "Job dashboard", url: JOB_URL },
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("keeps only the first link when labels repeat", () => {
    renderWithDebugInfo({
      external_links: [
        { label: "Job dashboard", url_text: "first", url: JOB_URL },
        {
          label: "Job dashboard",
          url_text: "second",
          url: "https://example.com/other",
        },
      ],
    });

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "first" })).toBeInTheDocument();
  });

  test("renders external links alongside the HuggingFace job link", () => {
    renderWithDebugInfo({
      huggingface_job: { id: "hf-1", namespace: "team" },
      external_links: [
        { label: "Job dashboard", url_text: "job-123", url: JOB_URL },
      ],
    });

    expect(screen.getByRole("link", { name: "hf-1" })).toHaveAttribute(
      "href",
      "https://huggingface.co/jobs/team/hf-1",
    );
    expect(screen.getByRole("link", { name: "job-123" })).toBeInTheDocument();
  });
});

describe("ExecutionDetails last updated", () => {
  const UPDATED_AT = "2024-01-02T12:00:00.000Z";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-02T12:00:45.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderWithUpdatedAt(updatedAt?: string) {
    mockUseFetchContainerExecutionState.mockReturnValue({
      data: { status: "RUNNING", updated_at: updatedAt },
      isLoading: false,
      error: null,
    });
    render(<ExecutionDetails executionId="exec-1" />);
  }

  test("shows how long ago the execution state was updated", () => {
    renderWithUpdatedAt(UPDATED_AT);

    expect(screen.getByText("Last updated")).toBeInTheDocument();
    expect(screen.getByText(/^45s ago \(/)).toBeInTheDocument();
  });

  test("keeps the relative time current while the panel stays open", () => {
    renderWithUpdatedAt(UPDATED_AT);

    act(() => vi.advanceTimersByTime(15_000));

    expect(screen.getByText(/^1m 0s ago \(/)).toBeInTheDocument();
  });

  test("omits the row when the backend does not report updated_at", () => {
    renderWithUpdatedAt(undefined);

    expect(screen.queryByText("Last updated")).not.toBeInTheDocument();
  });
});
