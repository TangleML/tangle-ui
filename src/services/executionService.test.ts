import { describe, expect, it } from "vitest";

import type { TaskStatusCounts } from "@/types/pipelineRun";

import { getRunStatus, STATUS } from "./executionService";

describe("getRunStatus()", () => {
  it("should return CANCELLED when there are cancelled tasks", () => {
    const statusData: TaskStatusCounts = {
      total: 5,
      succeeded: 2,
      failed: 1,
      running: 1,
      waiting: 0,
      skipped: 0,
      cancelled: 1,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.CANCELLED);
  });

  it("should return FAILED when there are failed tasks but no cancelled tasks", () => {
    const statusData: TaskStatusCounts = {
      total: 4,
      succeeded: 1,
      failed: 2,
      running: 1,
      waiting: 0,
      skipped: 0,
      cancelled: 0,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.FAILED);
  });

  it("should return RUNNING when there are running tasks but no cancelled or failed tasks", () => {
    const statusData: TaskStatusCounts = {
      total: 4,
      succeeded: 1,
      failed: 0,
      running: 2,
      waiting: 1,
      skipped: 0,
      cancelled: 0,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.RUNNING);
  });

  it("should return WAITING when there are waiting tasks but no cancelled, failed, or running tasks", () => {
    const statusData: TaskStatusCounts = {
      total: 3,
      succeeded: 1,
      failed: 0,
      running: 0,
      waiting: 2,
      skipped: 0,
      cancelled: 0,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.WAITING);
  });

  it("should return SUCCEEDED when there are succeeded tasks but no other active/problematic tasks", () => {
    const statusData: TaskStatusCounts = {
      total: 3,
      succeeded: 3,
      failed: 0,
      running: 0,
      waiting: 0,
      skipped: 0,
      cancelled: 0,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.SUCCEEDED);
  });

  it("should return UNKNOWN when all task counts are zero", () => {
    const statusData: TaskStatusCounts = {
      total: 0,
      succeeded: 0,
      failed: 0,
      running: 0,
      waiting: 0,
      skipped: 0,
      cancelled: 0,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.UNKNOWN);
  });

  it("should return SKIPPED when only skipped tasks exist", () => {
    const statusData: TaskStatusCounts = {
      total: 2,
      succeeded: 0,
      failed: 0,
      running: 0,
      waiting: 0,
      skipped: 2,
      cancelled: 0,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.SKIPPED);
  });

  it("should prioritize CANCELLED over all other statuses", () => {
    const statusData: TaskStatusCounts = {
      total: 6,
      succeeded: 1,
      failed: 1,
      running: 1,
      waiting: 1,
      skipped: 1,
      cancelled: 1,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.CANCELLED);
  });

  it("should prioritize FAILED over RUNNING, WAITING, and SUCCEEDED", () => {
    const statusData: TaskStatusCounts = {
      total: 5,
      succeeded: 1,
      failed: 1,
      running: 1,
      waiting: 1,
      skipped: 1,
      cancelled: 0,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.FAILED);
  });

  it("should prioritize RUNNING over SKIPPED, WAITING, and SUCCEEDED", () => {
    const statusData: TaskStatusCounts = {
      total: 4,
      succeeded: 1,
      failed: 0,
      running: 1,
      waiting: 1,
      skipped: 1,
      cancelled: 0,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.RUNNING);
  });

  it("should prioritize SKIPPED over WAITING and SUCCEEDED", () => {
    const statusData: TaskStatusCounts = {
      total: 3,
      succeeded: 1,
      failed: 0,
      running: 0,
      waiting: 1,
      skipped: 1,
      cancelled: 0,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.SKIPPED);
  });

  it("should prioritize WAITING over SUCCEEDED when nothing else is active", () => {
    const statusData: TaskStatusCounts = {
      total: 3,
      succeeded: 1,
      failed: 0,
      running: 0,
      waiting: 1,
      skipped: 0,
      cancelled: 0,
    };

    expect(getRunStatus(statusData)).toBe(STATUS.WAITING);
  });
});
