import { describe, expect, it } from "vitest";

import { formatDuration, formatTimeAgo } from "./date";

describe("formatDuration", () => {
  it("formats seconds correctly", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-01T10:00:30.000Z"; // 30 seconds later
    expect(formatDuration(start, end)).toBe("30s");
  });

  it("formats minutes and seconds correctly", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-01T10:02:30.000Z"; // 2 minutes 30 seconds later
    expect(formatDuration(start, end)).toBe("2m 30s");
  });

  it("formats hours, minutes, and seconds correctly", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-01T11:23:45.000Z"; // 1 hour 23 minutes 45 seconds later
    expect(formatDuration(start, end)).toBe("1h 23m 45s");
  });

  it("handles zero seconds", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-01T10:01:00.000Z"; // exactly 1 minute
    expect(formatDuration(start, end)).toBe("1m 0s");
  });

  it("handles zero minutes", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-01T11:00:05.000Z"; // 1 hour 5 seconds
    expect(formatDuration(start, end)).toBe("1h 0m 5s");
  });

  it("handles exact hour", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-01T12:00:00.000Z"; // exactly 2 hours
    expect(formatDuration(start, end)).toBe("2h 0m 0s");
  });

  it("handles zero duration", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-01T10:00:00.000Z"; // same time
    expect(formatDuration(start, end)).toBe("0s");
  });

  it("handles sub-second durations", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-01T10:00:00.500Z"; // 500ms
    expect(formatDuration(start, end)).toBe("0s");
  });

  it("handles milliseconds by truncating", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-01T10:00:01.999Z"; // 1.999 seconds
    expect(formatDuration(start, end)).toBe("1s");
  });

  it("handles negative duration", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-01T09:00:00.000Z"; // end before start
    expect(formatDuration(start, end)).toBe("Invalid duration");
  });

  it("handles large durations", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-02T15:30:45.000Z"; // 29 hours 30 minutes 45 seconds
    expect(formatDuration(start, end)).toBe("29h 30m 45s");
  });

  it("handles real-world scenario: quick task", () => {
    const start = "2025-01-20T18:28:00.000Z";
    const end = "2025-01-20T18:28:46.000Z"; // 46 seconds (like in the screenshot)
    expect(formatDuration(start, end)).toBe("46s");
  });

  it("handles real-world scenario: medium task", () => {
    const start = "2025-01-20T18:00:00.000Z";
    const end = "2025-01-20T18:05:30.000Z"; // 5 minutes 30 seconds
    expect(formatDuration(start, end)).toBe("5m 30s");
  });

  it("handles real-world scenario: long task", () => {
    const start = "2025-01-20T10:00:00.000Z";
    const end = "2025-01-20T12:15:20.000Z"; // 2 hours 15 minutes 20 seconds
    expect(formatDuration(start, end)).toBe("2h 15m 20s");
  });

  it("handles different date formats", () => {
    // ISO format without milliseconds
    const start = "2024-01-01T10:00:00Z";
    const end = "2024-01-01T10:01:30Z";
    expect(formatDuration(start, end)).toBe("1m 30s");
  });

  it("handles Date objects converted to ISO strings", () => {
    const startDate = new Date("2024-01-01T10:00:00.000Z");
    const endDate = new Date("2024-01-01T10:02:15.000Z");
    expect(formatDuration(startDate.toISOString(), endDate.toISOString())).toBe(
      "2m 15s",
    );
  });
});

describe("formatTimeAgo", () => {
  const now = new Date("2024-01-02T12:00:00.000Z");

  it.each([
    ["2024-01-02T11:59:15.000Z", "45s ago"],
    ["2024-01-02T11:57:30.000Z", "2m 30s ago"],
    ["2024-01-02T10:36:15.000Z", "1h 23m 45s ago"],
    ["2024-01-01T12:00:00.000Z", "1 day ago"],
    ["2023-12-30T11:00:00.000Z", "3 days ago"],
  ])("formats %s as %s", (date, expected) => {
    expect(formatTimeAgo(date, now)).toBe(expected);
  });

  it("clamps a timestamp ahead of now to 0s ago", () => {
    expect(formatTimeAgo("2024-01-02T12:00:05.000Z", now)).toBe("0s ago");
  });

  it("accepts a millisecond timestamp for now", () => {
    expect(formatTimeAgo("2024-01-02T11:59:50.000Z", now.getTime())).toBe(
      "10s ago",
    );
  });
});
