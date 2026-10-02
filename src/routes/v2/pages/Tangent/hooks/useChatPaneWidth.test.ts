import { describe, expect, it } from "vitest";

import {
  MAX_CHAT_WIDTH,
  MIN_CHAT_WIDTH,
  MIN_WORKAREA_WIDTH,
} from "@/routes/v2/pages/Tangent/layout";

import { chatWidthCeiling } from "./useChatPaneWidth";

const DOCK = 320;

describe("chatWidthCeiling", () => {
  it("leaves the workarea its minimum on a narrow window", () => {
    const rowWidth = DOCK + MIN_WORKAREA_WIDTH + 500;

    expect(chatWidthCeiling(rowWidth, DOCK)).toBe(500);
  });

  it("never exceeds the chat's own maximum on a wide window", () => {
    expect(chatWidthCeiling(6000, DOCK)).toBe(MAX_CHAT_WIDTH);
  });

  it("holds the chat's minimum rather than collapsing it", () => {
    expect(chatWidthCeiling(DOCK + MIN_WORKAREA_WIDTH, DOCK)).toBe(
      MIN_CHAT_WIDTH,
    );
    expect(chatWidthCeiling(200, DOCK)).toBe(MIN_CHAT_WIDTH);
  });

  it("does not clamp before the row has been measured", () => {
    expect(chatWidthCeiling(0, DOCK)).toBe(MAX_CHAT_WIDTH);
  });

  it("gives back the room a collapsed dock released", () => {
    const rowWidth = 1400;

    expect(chatWidthCeiling(rowWidth, 36)).toBeGreaterThan(
      chatWidthCeiling(rowWidth, DOCK),
    );
  });
});
