import { describe, expect, it, vi } from "vitest";

import { NotTextFileError, readTextFromFile, readYamlFromFile } from "./dom";

describe("readTextFromFile", () => {
  it("reads a text file", async () => {
    const file = new File(["# Model card\n\nTrained on Q3"], "model-card.md");

    await expect(readTextFromFile(file)).resolves.toBe(
      "# Model card\n\nTrained on Q3",
    );
  });

  it("reads text whatever the file is called", async () => {
    const file = new File(["plain words"], "NOTES");

    await expect(readTextFromFile(file)).resolves.toBe("plain words");
  });

  it("reads an empty file as empty text", async () => {
    const file = new File([], "empty.txt");

    await expect(readTextFromFile(file)).resolves.toBe("");
  });

  it("refuses bytes that are not UTF-8 text", async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff])],
      "chart.png",
    );

    await expect(readTextFromFile(file)).rejects.toBeInstanceOf(
      NotTextFileError,
    );
  });

  it("refuses valid UTF-8 that carries NUL bytes, as binary formats do", async () => {
    const file = new File(["header\0\0\0body"], "model.bin");

    await expect(readTextFromFile(file)).rejects.toBeInstanceOf(
      NotTextFileError,
    );
  });

  it("passes on the browser's error when it can't read the file", async () => {
    const file = new File(["gone"], "moved.txt");
    const notFound = new Error("NotFound");
    vi.spyOn(file, "arrayBuffer").mockRejectedValue(notFound);

    await expect(readTextFromFile(file)).rejects.toBe(notFound);
  });
});

describe("readYamlFromFile", () => {
  it("reads a YAML file", async () => {
    const file = new File(["name: Train"], "component.yaml");

    await expect(readYamlFromFile(file)).resolves.toBe("name: Train");
  });

  it("refuses a file that isn't named .yaml", async () => {
    const file = new File(["name: Train"], "component.txt");

    await expect(readYamlFromFile(file)).rejects.toThrow(
      "Only YAML files are supported",
    );
  });
});
