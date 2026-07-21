import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { RunTimingSummary } from "./RunTimingSummary";

afterEach(cleanup);

it("shows Quicksite-compatible timing metrics", () => {
  render(
    <RunTimingSummary
      metrics={{
        wallClockDurationMs: 5 * 60_000,
        totalTaskCount: 12,
        cachedTaskCount: 3,
        startupCoverage: 4,
        averageStartupMs: 30_000,
        busyRuntimeMs: 10 * 60_000,
        busyPercent: 50,
        criticalPathDurationMs: 4 * 60_000,
      }}
    />,
  );

  expect(screen.getByText("5m 0s")).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(screen.getByText("3")).toBeInTheDocument();
  expect(screen.getByText("4 tasks with startup timing")).toBeInTheDocument();
  expect(screen.getByText("10m 0s")).toBeInTheDocument();
  expect(screen.getByText("50% of wall clock")).toBeInTheDocument();
  expect(screen.getByText("4m 0s")).toBeInTheDocument();
});
