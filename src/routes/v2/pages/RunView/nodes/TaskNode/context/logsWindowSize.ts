import type { Size } from "@/routes/v2/shared/windows/types";

const MIN_WIDTH = 520;
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 520;

// Monaco's default 14px monospace face advances ~8.4px per character; the gutter
// covers line numbers plus the editor and window chrome around them.
const CHAR_WIDTH = 8.4;
const GUTTER_WIDTH = 96;

// Keeps a content-sized window clear of the right edge at the window store's
// default cascade position; positions deeper in the cascade are not clamped on
// first open, so those can still overhang.
const VIEWPORT_MARGIN = 160;

function longestLineLength(texts: (string | null | undefined)[]) {
  return texts
    .flatMap((text) => (text ? text.split("\n") : []))
    .reduce((longest, line) => Math.max(longest, line.length), 0);
}

export function getLogsWindowSize(
  logTexts: (string | null | undefined)[],
  viewport: Size,
): Size {
  const longestLine = longestLineLength(logTexts);
  const contentWidth = longestLine
    ? longestLine * CHAR_WIDTH + GUTTER_WIDTH
    : MIN_WIDTH;

  const widthCeiling = Math.max(
    MIN_WIDTH,
    Math.min(MAX_WIDTH, viewport.width - VIEWPORT_MARGIN),
  );

  return {
    width: Math.round(
      Math.min(widthCeiling, Math.max(MIN_WIDTH, contentWidth)),
    ),
    height: Math.round(Math.min(MAX_HEIGHT, viewport.height * 0.8)),
  };
}
