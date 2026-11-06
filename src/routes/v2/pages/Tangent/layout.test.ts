import { describe, expect, it } from "vitest";

import { chatWidthCeiling } from "./hooks/useChatPaneWidth";
import { snapsWorkareaShut } from "./layout";

const DOCK = 320;

describe("when dragging the chat divider snaps the workarea shut", () => {
  it.each([1512, 1920, 2560])(
    "snaps just past where the divider stops on a %ipx row",
    (row) => {
      const stop = chatWidthCeiling(row, DOCK);

      expect(snapsWorkareaShut(true, stop, stop + 10)).toBe(false);
      expect(snapsWorkareaShut(true, stop, stop + 30)).toBe(true);
    },
  );

  it("never snaps before the row has been measured", () => {
    expect(snapsWorkareaShut(false, 760, 5000)).toBe(false);
  });
});
