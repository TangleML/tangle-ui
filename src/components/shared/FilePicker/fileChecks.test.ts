import { describe, expect, it, vi } from "vitest";

import {
  checkFile,
  type FileCheckError,
  type FileCheckOptions,
  formatBytes,
  matchesAccept,
  readCheckedText,
  YAML_FILE_ACCEPT,
} from "./fileChecks";

const yamlOptions: FileCheckOptions = {
  accept: YAML_FILE_ACCEPT,
  maxBytes: 1024,
  requireText: true,
};

const anyTextOptions: FileCheckOptions = {
  accept: "any",
  maxBytes: null,
  requireText: true,
};

async function rejectionOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as FileCheckError;
  }
  throw new Error("expected the promise to reject");
}

describe("formatBytes", () => {
  it("names sizes in the largest whole unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(5242880)).toBe("5 MB");
  });
});

describe("matchesAccept", () => {
  it("matches the extension whatever its case", () => {
    const file = new File(["name: Train"], "PIPELINE.YML");

    expect(matchesAccept(file, YAML_FILE_ACCEPT)).toBe(true);
  });

  it("goes by the name, not the type the browser reports", () => {
    const yamlTyped = new File(["name: Train"], "pipeline.txt", {
      type: "application/yaml",
    });
    const untyped = new File(["name: Train"], "pipeline.yaml");

    expect(matchesAccept(yamlTyped, YAML_FILE_ACCEPT)).toBe(false);
    expect(matchesAccept(untyped, YAML_FILE_ACCEPT)).toBe(true);
  });

  it("accepts every file when accept is any", () => {
    expect(matchesAccept(new File([], "NOTES"), "any")).toBe(true);
    expect(matchesAccept(new File([], "chart.png"), "any")).toBe(true);
  });

  it("matches an entry without a leading dot as a plain name suffix", () => {
    expect(matchesAccept(new File([], "pipeline.yaml"), ["yaml"])).toBe(true);
    expect(matchesAccept(new File([], "notyaml"), ["yaml"])).toBe(true);
  });

  it("accepts no file when accept is empty", () => {
    expect(matchesAccept(new File([], "pipeline.yaml"), [])).toBe(false);
  });
});

describe("checkFile", () => {
  it("passes a file with an accepted name inside the size limit", () => {
    const file = new File(["name: Train"], "pipeline.yaml");

    expect(checkFile(file, yamlOptions)).toBeNull();
  });

  it("reports the extension before the size", () => {
    const file = new File([new Uint8Array(2048)], "chart.png");

    const error = checkFile(file, yamlOptions);

    expect(error?.reason).toBe("extension");
    expect(error?.message).toBe("chart.png isn't a .yaml or .yml file.");
  });

  it("reports a file over the size limit", () => {
    const file = new File([new Uint8Array(2048)], "pipeline.yaml");

    const error = checkFile(file, yamlOptions);

    expect(error?.reason).toBe("size");
    expect(error?.file).toBe(file);
    expect(error?.message).toBe("pipeline.yaml is larger than 1 KB.");
  });

  it("passes a file exactly at the size limit and reports one byte over", () => {
    const atLimit = new File([new Uint8Array(1024)], "pipeline.yaml");
    const overLimit = new File([new Uint8Array(1025)], "pipeline.yaml");

    expect(checkFile(atLimit, yamlOptions)).toBeNull();
    expect(checkFile(overLimit, yamlOptions)?.reason).toBe("size");
  });

  it("rejects every file when accept is empty, with an empty list in the message", () => {
    const file = new File(["name: Train"], "pipeline.yaml");

    const error = checkFile(file, { ...yamlOptions, accept: [] });

    expect(error?.reason).toBe("extension");
    expect(error?.message).toBe("pipeline.yaml isn't a  file.");
  });

  it("skips the size check when maxBytes is null", () => {
    const file = new File([new Uint8Array(2048)], "pipeline.yaml");

    expect(checkFile(file, { ...yamlOptions, maxBytes: null })).toBeNull();
  });
});

describe("readCheckedText", () => {
  it("throws the check's error without reading the file", async () => {
    const file = new File(["name: Train"], "pipeline.txt");
    const arrayBuffer = vi.spyOn(file, "arrayBuffer");
    const text = vi.spyOn(file, "text");

    const error = await rejectionOf(readCheckedText(file, yamlOptions));

    expect(error).toEqual(checkFile(file, yamlOptions));
    expect(error.reason).toBe("extension");
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
  });

  it("reads UTF-8 text and drops its byte order mark", async () => {
    const file = new File(
      [new Uint8Array([0xef, 0xbb, 0xbf, 0x6e, 0x61, 0x6d, 0x65])],
      "pipeline.yaml",
    );

    await expect(readCheckedText(file, yamlOptions)).resolves.toBe("name");
  });

  it("refuses bytes that are not UTF-8 text", async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff])],
      "chart.png",
    );

    const error = await rejectionOf(readCheckedText(file, anyTextOptions));

    expect(error.reason).toBe("not-text");
    expect(error.message).toBe("chart.png isn't a text file.");
  });

  it("refuses a NUL byte when text is required", async () => {
    const file = new File(["header\0body"], "model.bin");

    const error = await rejectionOf(readCheckedText(file, anyTextOptions));

    expect(error.reason).toBe("not-text");
  });

  it("reads leniently when text is not required", async () => {
    const options = { ...anyTextOptions, requireText: false };
    const nul = new File(["header\0body"], "model.bin");
    const invalid = new File([new Uint8Array([0x61, 0xff])], "chart.png");

    await expect(readCheckedText(nul, options)).resolves.toBe("header\0body");
    await expect(readCheckedText(invalid, options)).resolves.toBe("a\uFFFD");
  });

  it("reports a file the browser can't read", async () => {
    const file = new File(["gone"], "moved.txt");
    vi.spyOn(file, "arrayBuffer").mockRejectedValue(new Error("NotFound"));

    const error = await rejectionOf(readCheckedText(file, anyTextOptions));

    expect(error.reason).toBe("unreadable");
    expect(error.message).toBe("Couldn't read moved.txt.");
  });

  it("uses a caller's message in place of the default wording", async () => {
    const file = new File(["header\0body"], "model.bin");
    const options: FileCheckOptions = {
      ...anyTextOptions,
      messages: { "not-text": (badFile) => `${badFile.name} must be text` },
    };

    const error = await rejectionOf(readCheckedText(file, options));

    expect(error.reason).toBe("not-text");
    expect(error.message).toBe("model.bin must be text");
  });
});
