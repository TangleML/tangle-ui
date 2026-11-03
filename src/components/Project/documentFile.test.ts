import { describe, expect, it, vi } from "vitest";

import { readDocumentFile } from "./documentFile";

describe("readDocumentFile", () => {
  it("reads a text file into its content, titled with its whole name", async () => {
    const file = new File(["# Model card\n\nTrained on Q3"], "model-card.md");

    await expect(readDocumentFile(file)).resolves.toEqual({
      ok: true,
      title: "model-card.md",
      content: "# Model card\n\nTrained on Q3",
    });
  });

  it("explains that only text can be a document", async () => {
    const file = new File([new Uint8Array([0xff, 0xfe, 0x00])], "chart.png");

    await expect(readDocumentFile(file)).resolves.toEqual({
      ok: false,
      error:
        "chart.png isn't a text file. Only text can be added as a document.",
    });
  });

  it("refuses a file larger than 1 MB", async () => {
    const file = new File(
      [new Uint8Array(1024 * 1024 + 1).fill(97)],
      "big.txt",
    );

    await expect(readDocumentFile(file)).resolves.toEqual({
      ok: false,
      error: "big.txt is larger than 1 MB.",
    });
  });

  it("accepts a file of exactly 1 MB", async () => {
    const file = new File([new Uint8Array(1024 * 1024).fill(97)], "full.txt");

    await expect(readDocumentFile(file)).resolves.toMatchObject({ ok: true });
  });

  it("names the file it couldn't read", async () => {
    const file = new File(["gone"], "moved.txt");
    vi.spyOn(file, "arrayBuffer").mockRejectedValue(new Error("NotFound"));

    await expect(readDocumentFile(file)).resolves.toEqual({
      ok: false,
      error: "Couldn't read moved.txt.",
    });
  });
});
