import { describe, expect, it } from "vitest";

import { CMDALT, SHIFT } from "@/routes/v2/shared/shortcuts/keys";

import { formatShortcut } from "./ShortcutBadge";

describe("formatShortcut", () => {
  it("labels CMDALT as Alt on non-mac platforms", () => {
    expect(formatShortcut([CMDALT, SHIFT, "L"], false)).toBe("Alt+Shift+L");
  });

  it("keeps mac shortcut symbols", () => {
    expect(formatShortcut([CMDALT, SHIFT, "L"], true)).toBe("⌘ ⇧ L");
  });
});
