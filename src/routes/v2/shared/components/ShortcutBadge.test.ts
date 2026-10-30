import { describe, expect, it } from "vitest";

import { CMDALT, CTRL, SHIFT } from "@/routes/v2/shared/shortcuts/keys";

import { formatShortcut } from "./ShortcutBadge";

describe("formatShortcut", () => {
  it("labels CMDALT as Ctrl on non-mac platforms", () => {
    expect(formatShortcut([CMDALT, SHIFT, "L"], false)).toBe("Ctrl+Shift+L");
  });

  it("keeps mac shortcut symbols", () => {
    expect(formatShortcut([CMDALT, SHIFT, "L"], true)).toBe("⌘ ⇧ L");
  });

  it("labels CTRL with the Control symbol on mac", () => {
    expect(formatShortcut([CTRL, "O"], true)).toBe("⌃ O");
  });
});
