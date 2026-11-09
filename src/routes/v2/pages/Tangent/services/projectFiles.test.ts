import { describe, expect, it } from "vitest";

import { fileIcon } from "./projectFiles";

describe("fileIcon", () => {
  it("picks an icon by kind of file", () => {
    expect(fileIcon("a/site/index.html")).toBe("Globe");
    expect(fileIcon("deck.key")).toBe("Presentation");
    expect(fileIcon("data.xlsx")).toBe("Sheet");
    expect(fileIcon("notes.md")).toBe("File");
  });
});
