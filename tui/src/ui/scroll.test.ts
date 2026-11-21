import assert from "node:assert/strict";
import { test } from "node:test";

import { clampScrollOffset, topOffsetFromBottom } from "./scroll.ts";

test("clampScrollOffset pins to 0 when content fits the viewport", () => {
  assert.equal(clampScrollOffset(0, 10, 20), 0);
  assert.equal(clampScrollOffset(5, 10, 20), 0);
  assert.equal(clampScrollOffset(-3, 10, 20), 0);
});

test("clampScrollOffset clamps to the overflow when scrolled past the top", () => {
  assert.equal(clampScrollOffset(100, 50, 20), 30);
});

test("clampScrollOffset clamps to the bottom when scrolled past it", () => {
  assert.equal(clampScrollOffset(-5, 50, 20), 0);
});

test("clampScrollOffset keeps an in-range offset untouched", () => {
  assert.equal(clampScrollOffset(12, 50, 20), 12);
});

test("topOffsetFromBottom anchors the newest content at the bottom by default", () => {
  assert.equal(topOffsetFromBottom(0, 50, 20), 30);
});

test("topOffsetFromBottom is 0 when scrolled fully to the top", () => {
  assert.equal(topOffsetFromBottom(30, 50, 20), 0);
});

test("topOffsetFromBottom is 0 when content fits the viewport", () => {
  assert.equal(topOffsetFromBottom(0, 10, 20), 0);
});
