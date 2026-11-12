import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatRunsPill } from "./ChatRunsPill";

const openWorkareaTarget = vi.fn();
const dismiss = vi.fn().mockResolvedValue(undefined);
const runs = vi.hoisted(() => ({ current: [] as unknown[] }));
const stats = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ openWorkareaTarget }),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useSessionRuns", () => ({
  useSessionRuns: () => ({ runs: runs.current, dismiss }),
}));

vi.mock("@/services/projects/useProjectRuns", () => ({
  useRunsExecutionStats: (ids: string[]) =>
    ids.map((id) => ({ data: stats.current[id] })),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

vi.mock("@/utils/date", () => ({ formatRelativeTime: () => "just now" }));

function run(id: string, name: string, dismissed = false) {
  return { id, name, addedAt: new Date("2026-11-09"), dismissed };
}

function renderPill() {
  return render(
    <ChatRunsPill
      name="composer-pill"
      kind="message"
      props={{ sessionId: "session-1", agentId: "pi" }}
    />,
  );
}

describe("ChatRunsPill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runs.current = [];
    stats.current = {};
  });

  it("stays out of the way while the chat has no runs", () => {
    runs.current = [run("r-1", "Old run", true)];

    const { container } = renderPill();

    expect(container).toBeEmptyDOMElement();
  });

  it("counts the chat's runs and the ones still running", () => {
    runs.current = [run("r-1", "Nightly"), run("r-2", "Backfill")];
    stats.current = {
      "r-1": { RUNNING: 1, SUCCEEDED: 2 },
      "r-2": { SUCCEEDED: 3 },
    };

    renderPill();

    expect(
      screen.getByRole("button", { name: "2 runs · 1 running" }),
    ).toBeInTheDocument();
  });

  it("says when one of them failed", () => {
    runs.current = [run("r-1", "Nightly")];
    stats.current = { "r-1": { FAILED: 1, SUCCEEDED: 2 } };

    renderPill();

    expect(
      screen.getByRole("button", { name: "1 run, one failed" }),
    ).toBeInTheDocument();
  });

  it("opens a run beside the chat and dismisses another", async () => {
    const user = userEvent.setup();
    runs.current = [run("r-1", "Nightly"), run("r-2", "Backfill")];
    stats.current = { "r-1": { SUCCEEDED: 1 }, "r-2": { SUCCEEDED: 1 } };
    renderPill();

    await user.click(screen.getByRole("button", { name: "2 runs" }));
    await user.click(screen.getByRole("button", { name: "Dismiss Backfill" }));
    await user.click(screen.getByText("Nightly"));

    expect(dismiss).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r-2" }),
    );
    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "run", identity: "id/r-1" },
      "Nightly",
    );
  });

  it("clears every finished run at once", async () => {
    const user = userEvent.setup();
    runs.current = [run("r-1", "Nightly"), run("r-2", "Backfill")];
    stats.current = { "r-1": { RUNNING: 1 }, "r-2": { SUCCEEDED: 1 } };
    renderPill();

    await user.click(
      screen.getByRole("button", { name: "2 runs · 1 running" }),
    );
    await user.click(screen.getByRole("button", { name: "Clear finished" }));

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r-2" }),
    );
  });

  it("keeps a run that has no status yet when clearing finished ones", async () => {
    const user = userEvent.setup();
    runs.current = [run("r-1", "Just started"), run("r-2", "Backfill")];
    stats.current = { "r-2": { SUCCEEDED: 1 } };
    renderPill();

    await user.click(screen.getByRole("button", { name: "2 runs" }));
    await user.click(screen.getByRole("button", { name: "Clear finished" }));

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r-2" }),
    );
  });

  it("doesn't offer to clear a failed run whose other tasks are still going", async () => {
    const user = userEvent.setup();
    runs.current = [run("r-1", "Nightly")];
    stats.current = { "r-1": { FAILED: 1, RUNNING: 1 } };
    renderPill();

    await user.click(screen.getByRole("button", { name: "1 run, one failed" }));

    expect(screen.getByText("Runs in this chat")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear finished" }),
    ).not.toBeInTheDocument();
  });
});
