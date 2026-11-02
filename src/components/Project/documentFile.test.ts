import { describe, expect, it } from "vitest";

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

  it("reads text whatever the file is called", async () => {
    const file = new File(["plain words"], "NOTES");

    await expect(readDocumentFile(file)).resolves.toMatchObject({
      ok: true,
      content: "plain words",
    });
  });

  it("refuses bytes that are not UTF-8 text", async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff])],
      "chart.png",
    );

    await expect(readDocumentFile(file)).resolves.toEqual({
      ok: false,
      error:
        "chart.png isn't a text file. Only text can be added as a document.",
    });
  });

  it("refuses valid UTF-8 that carries NUL bytes, as binary formats do", async () => {
    const file = new File(["header\0\0\0body"], "model.bin");

    await expect(readDocumentFile(file)).resolves.toMatchObject({ ok: false });
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
});
