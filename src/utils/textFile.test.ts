import { describe, expect, it, vi } from "vitest";

import { readTextFile } from "./textFile";

describe("readTextFile", () => {
  it("reads a text file", async () => {
    const file = new File(["# Model card\n\nTrained on Q3"], "model-card.md");

    await expect(readTextFile(file)).resolves.toEqual({
      ok: true,
      text: "# Model card\n\nTrained on Q3",
    });
  });

  it("reads text whatever the file is called", async () => {
    const file = new File(["plain words"], "NOTES");

    await expect(readTextFile(file)).resolves.toEqual({
      ok: true,
      text: "plain words",
    });
  });

  it("refuses bytes that are not UTF-8 text", async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff])],
      "chart.png",
    );

    await expect(readTextFile(file)).resolves.toEqual({
      ok: false,
      reason: "not_text",
    });
  });

  it("refuses valid UTF-8 that carries NUL bytes, as binary formats do", async () => {
    const file = new File(["header\0\0\0body"], "model.bin");

    await expect(readTextFile(file)).resolves.toEqual({
      ok: false,
      reason: "not_text",
    });
  });

  it("refuses a file larger than the limit", async () => {
    const file = new File(["12345"], "five-bytes.txt");

    await expect(readTextFile(file, { maxBytes: 4 })).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("accepts a file exactly at the limit", async () => {
    const file = new File(["1234"], "four-bytes.txt");

    await expect(readTextFile(file, { maxBytes: 4 })).resolves.toEqual({
      ok: true,
      text: "1234",
    });
  });

  it("says so when the browser can't read the file", async () => {
    const file = new File(["gone"], "moved.txt");
    vi.spyOn(file, "arrayBuffer").mockRejectedValue(new Error("NotFound"));

    await expect(readTextFile(file)).resolves.toEqual({
      ok: false,
      reason: "unreadable",
    });
  });
});
