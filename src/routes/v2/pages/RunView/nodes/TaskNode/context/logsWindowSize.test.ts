import { describe, expect, test } from "vitest";

import { getLogsWindowSize } from "./logsWindowSize";

const LARGE_VIEWPORT = { width: 2560, height: 1440 };

describe("getLogsWindowSize", () => {
  test("falls back to the minimum width when the log has not loaded yet", () => {
    expect(getLogsWindowSize([], LARGE_VIEWPORT).width).toBe(520);
  });

  test("uses the minimum width for short lines", () => {
    expect(getLogsWindowSize(["ok\ndone\n"], LARGE_VIEWPORT).width).toBe(520);
  });

  test("widens to fit the longest line", () => {
    const width = getLogsWindowSize(
      [`short\n${"x".repeat(100)}\nshort`],
      LARGE_VIEWPORT,
    ).width;

    expect(width).toBeGreaterThan(520);
    expect(width).toBeLessThan(1280);
  });

  test("caps at the maximum width for very long lines", () => {
    expect(getLogsWindowSize(["y".repeat(5000)], LARGE_VIEWPORT).width).toBe(
      1280,
    );
  });

  test("clamps to the viewport, leaving room for the cascade offset", () => {
    expect(
      getLogsWindowSize(["y".repeat(5000)], { width: 1024, height: 768 }).width,
    ).toBe(864);
  });

  test("never drops below the minimum width on a narrow viewport", () => {
    expect(
      getLogsWindowSize(["y".repeat(5000)], { width: 600, height: 500 }).width,
    ).toBe(520);
  });

  test("measures across every log the window will show", () => {
    expect(
      getLogsWindowSize([undefined, "z".repeat(5000)], LARGE_VIEWPORT).width,
    ).toBe(1280);
  });

  test("caps height against the viewport", () => {
    expect(getLogsWindowSize([], LARGE_VIEWPORT).height).toBe(520);
    expect(getLogsWindowSize([], { width: 1024, height: 500 }).height).toBe(
      400,
    );
  });

  test("never drops below the minimum height on a short viewport", () => {
    expect(getLogsWindowSize([], { width: 1024, height: 300 }).height).toBe(
      280,
    );
  });
});
