import { describe, expect, it } from "vitest";

import { createCsomBridgeHandlers } from "./csomBridge";

describe("csomBridge module initialization", () => {
  it("loads without the editor node barrel having been imported first", () => {
    expect(typeof createCsomBridgeHandlers).toBe("function");
  });
});
