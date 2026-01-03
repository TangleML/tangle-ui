import { describe, expect, test } from "vitest";

import { convertExecutionStatsToStatusCounts } from "./executionService";

describe("convertExecutionStatsToStatusCounts()", () => {
  test("returns empty counts when stats is null", () => {
    const result = convertExecutionStatsToStatusCounts(null);

    expect(result).toEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      running: 0,
      pending: 0,
      waiting: 0,
      skipped: 0,
      cancelled: 0,
    });
  });

  test("returns empty counts when stats is undefined", () => {
    const result = convertExecutionStatsToStatusCounts(undefined);

    expect(result).toEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      running: 0,
      pending: 0,
      waiting: 0,
      skipped: 0,
      cancelled: 0,
    });
  });

  test("maps SUCCEEDED to succeeded", () => {
    const result = convertExecutionStatsToStatusCounts({ SUCCEEDED: 5 });

    expect(result.succeeded).toBe(5);
    expect(result.total).toBe(5);
  });

  test("maps FAILED to failed", () => {
    const result = convertExecutionStatsToStatusCounts({ FAILED: 3 });

    expect(result.failed).toBe(3);
    expect(result.total).toBe(3);
  });

  test("maps SYSTEM_ERROR to failed", () => {
    const result = convertExecutionStatsToStatusCounts({ SYSTEM_ERROR: 2 });

    expect(result.failed).toBe(2);
    expect(result.total).toBe(2);
  });

  test("maps INVALID to failed", () => {
    const result = convertExecutionStatsToStatusCounts({ INVALID: 1 });

    expect(result.failed).toBe(1);
    expect(result.total).toBe(1);
  });

  test("maps RUNNING to running", () => {
    const result = convertExecutionStatsToStatusCounts({ RUNNING: 4 });

    expect(result.running).toBe(4);
    expect(result.total).toBe(4);
  });

  test("maps STARTING to running", () => {
    const result = convertExecutionStatsToStatusCounts({ STARTING: 2 });

    expect(result.running).toBe(2);
    expect(result.total).toBe(2);
  });

  test("maps PENDING to pending", () => {
    const result = convertExecutionStatsToStatusCounts({ PENDING: 3 });

    expect(result.pending).toBe(3);
    expect(result.total).toBe(3);
  });

  test("maps SKIPPED to skipped", () => {
    const result = convertExecutionStatsToStatusCounts({ SKIPPED: 2 });

    expect(result.skipped).toBe(2);
    expect(result.total).toBe(2);
  });

  test("maps UPSTREAM_FAILED_OR_SKIPPED to skipped", () => {
    const result = convertExecutionStatsToStatusCounts({
      UPSTREAM_FAILED_OR_SKIPPED: 1,
    });

    expect(result.skipped).toBe(1);
    expect(result.total).toBe(1);
  });

  test("maps CANCELLED to cancelled", () => {
    const result = convertExecutionStatsToStatusCounts({ CANCELLED: 2 });

    expect(result.cancelled).toBe(2);
    expect(result.total).toBe(2);
  });

  test("maps CANCELLING to cancelled", () => {
    const result = convertExecutionStatsToStatusCounts({ CANCELLING: 1 });

    expect(result.cancelled).toBe(1);
    expect(result.total).toBe(1);
  });

  test("maps unknown statuses to waiting", () => {
    const result = convertExecutionStatsToStatusCounts({
      WAITING_FOR_UPSTREAM: 3,
      QUEUED: 2,
      UNINITIALIZED: 1,
    });

    expect(result.waiting).toBe(6);
    expect(result.total).toBe(6);
  });

  test("aggregates multiple error statuses into failed", () => {
    const result = convertExecutionStatsToStatusCounts({
      FAILED: 2,
      SYSTEM_ERROR: 1,
      INVALID: 1,
      UPSTREAM_FAILED: 1,
    });

    expect(result.failed).toBe(5);
    expect(result.total).toBe(5);
  });

  test("correctly totals all status types", () => {
    const result = convertExecutionStatsToStatusCounts({
      SUCCEEDED: 10,
      FAILED: 2,
      RUNNING: 3,
      PENDING: 1,
      WAITING_FOR_UPSTREAM: 4,
      SKIPPED: 1,
      CANCELLED: 1,
    });

    expect(result.succeeded).toBe(10);
    expect(result.failed).toBe(2);
    expect(result.running).toBe(3);
    expect(result.pending).toBe(1);
    expect(result.waiting).toBe(4);
    expect(result.skipped).toBe(1);
    expect(result.cancelled).toBe(1);
    expect(result.total).toBe(22);
  });

  test("handles empty stats object", () => {
    const result = convertExecutionStatsToStatusCounts({});

    expect(result).toEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      running: 0,
      pending: 0,
      waiting: 0,
      skipped: 0,
      cancelled: 0,
    });
  });
});
