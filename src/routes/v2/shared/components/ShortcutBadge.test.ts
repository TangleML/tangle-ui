import { describe, expect, it } from "vitest";

import { CMD_OR_CTRL, CTRL, SHIFT } from "@/routes/v2/shared/shortcuts/keys";

import { formatShortcut } from "./ShortcutBadge";

describe("formatShortcut", () => {
  it("labels CMD_OR_CTRL as Ctrl on non-mac platforms", () => {
    expect(formatShortcut([CMD_OR_CTRL, SHIFT, "L"], false)).toBe(
      "Ctrl+Shift+L",
    );
  });

  it("keeps mac shortcut symbols", () => {
    expect(formatShortcut([CMD_OR_CTRL, SHIFT, "L"], true)).toBe("⌘ ⇧ L");
  });

  it("labels CTRL with the Control symbol on mac", () => {
    expect(formatShortcut([CTRL, "O"], true)).toBe("⌃ O");
  });
});
