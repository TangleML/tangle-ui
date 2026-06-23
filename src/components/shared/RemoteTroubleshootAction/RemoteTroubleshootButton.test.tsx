import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { GetExecutionInfoResponse } from "@/api/types.gen";

import { RemoteTroubleshootButton } from "./RemoteTroubleshootButton";

const { mockUseFetchExecutionDetails, mockGetRecord } = vi.hoisted(() => ({
  mockUseFetchExecutionDetails: vi.fn(),
  mockGetRecord: vi.fn(),
}));

vi.mock("@/services/executionService", () => ({
  useFetchExecutionDetails: mockUseFetchExecutionDetails,
}));

vi.mock("@/utils/remoteTroubleshootStorage", () => ({
  getRemoteTroubleshootRecord: mockGetRecord,
  saveRemoteTroubleshootRecord: vi.fn(),
}));

vi.mock("@/utils/user", () => ({
  getUserDetails: vi.fn().mockResolvedValue({ id: "user@example.com" }),
}));

const BUTTON_TEXT = "Get help with this execution";

function statusHistory(status: string, minutesAgo: number) {
  return {
    status_history: [
      {
        status,
        first_observed_at: new Date(
          Date.now() - minutesAgo * 60 * 1000,
        ).toISOString(),
      },
    ],
  } as GetExecutionInfoResponse;
}

function renderButton(status: string | undefined) {
  return render(
    <RemoteTroubleshootButton
      runId="run-1"
      executionId="exec-1"
      taskName="train"
      status={status}
    />,
  );
}

describe("RemoteTroubleshootButton", () => {
  beforeEach(() => {
    // isLocalEnvironment() returns null on localhost, which is jsdom's default host.
    vi.stubGlobal("location", {
      hostname: "app.example.com",
      origin: "https://app.example.com",
      pathname: "/runs/run-1",
      href: "https://app.example.com/runs/run-1",
      search: "",
    });
    window.__TANGLE_REMOTE_TROUBLESHOOT_ACTION__ = {
      endpointUrl: "https://example.com/troubleshoot",
      buttonText: BUTTON_TEXT,
    };
    mockGetRecord.mockReturnValue(null);
    mockUseFetchExecutionDetails.mockReturnValue({ data: undefined });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete window.__TANGLE_REMOTE_TROUBLESHOOT_ACTION__;
    vi.clearAllMocks();
  });

  test("FAILED is eligible immediately, without status history", () => {
    renderButton("FAILED");
    expect(screen.getByText(BUTTON_TEXT)).toBeInTheDocument();
  });

  test("PENDING is shown once it has been pending for over 5 minutes", async () => {
    mockUseFetchExecutionDetails.mockReturnValue({
      data: statusHistory("PENDING", 6),
    });
    renderButton("PENDING");
    await waitFor(() =>
      expect(screen.getByText(BUTTON_TEXT)).toBeInTheDocument(),
    );
  });

  test("PENDING is hidden when it has been pending for under 5 minutes", () => {
    mockUseFetchExecutionDetails.mockReturnValue({
      data: statusHistory("PENDING", 1),
    });
    renderButton("PENDING");
    expect(screen.queryByText(BUTTON_TEXT)).not.toBeInTheDocument();
  });

  test("PENDING is hidden when the server has no status history", () => {
    mockUseFetchExecutionDetails.mockReturnValue({ data: undefined });
    renderButton("PENDING");
    expect(screen.queryByText(BUTTON_TEXT)).not.toBeInTheDocument();
  });

  test("PENDING is hidden when the latest history entry is a different status", () => {
    // History says the node most recently entered RUNNING, so the displayed
    // PENDING has no trustworthy start time and the button stays hidden.
    mockUseFetchExecutionDetails.mockReturnValue({
      data: statusHistory("RUNNING", 6),
    });
    renderButton("PENDING");
    expect(screen.queryByText(BUTTON_TEXT)).not.toBeInTheDocument();
  });

  test("becomes eligible on a QUEUED->PENDING transition without remounting", async () => {
    // Panel opens while briefly QUEUED: hidden.
    mockUseFetchExecutionDetails.mockReturnValue({
      data: statusHistory("QUEUED", 1),
    });
    const { rerender } = render(
      <RemoteTroubleshootButton
        runId="run-1"
        executionId="exec-1"
        taskName="train"
        status="QUEUED"
      />,
    );
    expect(screen.queryByText(BUTTON_TEXT)).not.toBeInTheDocument();

    // Task transitions to PENDING and has been pending over 5 minutes. Because
    // status is part of the details query key, the refetch returns fresh
    // history and the button appears in the same open panel.
    mockUseFetchExecutionDetails.mockReturnValue({
      data: statusHistory("PENDING", 6),
    });
    rerender(
      <RemoteTroubleshootButton
        runId="run-1"
        executionId="exec-1"
        taskName="train"
        status="PENDING"
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(BUTTON_TEXT)).toBeInTheDocument(),
    );
  });

  test("submitted payload deep-links the node with the task name as nodeId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    renderButton("FAILED");
    fireEvent.click(screen.getByText(BUTTON_TEXT));
    fireEvent.click(await screen.findByRole("button", { name: /submit/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.execution_url).toContain("nodeId=train");
    expect(body.execution_url).not.toContain("nodeId=task_train");
  });

  test("shows an error message when submission fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    renderButton("FAILED");
    fireEvent.click(screen.getByText(BUTTON_TEXT));
    fireEvent.click(await screen.findByRole("button", { name: /submit/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Remote troubleshoot request failed/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  test("persisted confirmation uses the configured success message", () => {
    window.__TANGLE_REMOTE_TROUBLESHOOT_ACTION__ = {
      endpointUrl: "https://example.com/troubleshoot",
      buttonText: BUTTON_TEXT,
      successMessage:
        "Your request has been submitted. Follow along in #support.",
    };
    mockGetRecord.mockReturnValue({ requestedAt: new Date().toISOString() });

    renderButton("FAILED");

    expect(screen.getByText(/Follow along in #support\./)).toBeInTheDocument();
    expect(screen.queryByText(/session opened/)).not.toBeInTheDocument();
  });
});
