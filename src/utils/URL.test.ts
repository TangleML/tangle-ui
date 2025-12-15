import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  convertGcsUrlToBrowserUrl,
  convertGithubUrlToDirectoryUrl,
  convertHfUrlToDirectoryUrl,
  downloadYamlFromComponentText,
  getIdOrTitleFromPath,
  normalizeUrl,
} from "./URL";

// normalizeUrl tests
describe("normalizeUrl", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeUrl("")).toBe("");
  });

  it("returns empty string for input with only spaces", () => {
    expect(normalizeUrl("   ")).toBe("");
  });

  it("returns unchanged for http:// URLs", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("returns unchanged for https:// URLs", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("prepends http:// for URLs without protocol", () => {
    expect(normalizeUrl("example.com")).toBe("http://example.com");
  });

  it("trims spaces and prepends http:// if missing", () => {
    expect(normalizeUrl("  example.com  ")).toBe("http://example.com");
  });

  it("does not prepend protocol for uppercase HTTP/HTTPS", () => {
    expect(normalizeUrl("HTTP://example.com")).toBe("HTTP://example.com");
    expect(normalizeUrl("HTTPS://example.com")).toBe("HTTPS://example.com");
  });

  it("prepends http:// for other protocols", () => {
    expect(normalizeUrl("ftp://example.com")).toBe("http://ftp://example.com");
  });
});

// convertGcsUrlToBrowserUrl tests
describe("convertGcsUrlToBrowserUrl", () => {
  it("returns unchanged if not a gs:// url", () => {
    expect(convertGcsUrlToBrowserUrl("http://example.com", false)).toBe(
      "http://example.com",
    );
  });

  it("converts gs:// bucket to browser directory url", () => {
    expect(convertGcsUrlToBrowserUrl("gs://my-bucket/my-dir", true)).toBe(
      "https://console.cloud.google.com/storage/browser/my-bucket/my-dir",
    );
  });

  it("converts gs:// file to cloud storage url", () => {
    expect(convertGcsUrlToBrowserUrl("gs://my-bucket/my-file.txt", false)).toBe(
      "https://storage.cloud.google.com/my-bucket/my-file.txt",
    );
  });
});

// convertGithubUrlToDirectoryUrl tests
describe("convertGithubUrlToDirectoryUrl", () => {
  it("converts raw github url to directory url", () => {
    const rawUrl =
      "https://raw.githubusercontent.com/user/repo/commit/path/to/file.txt";
    expect(convertGithubUrlToDirectoryUrl(rawUrl)).toBe(
      "https://github.com/user/repo/tree/commit/path/to",
    );
  });

  it("converts web github url to directory url", () => {
    const webUrl = "https://github.com/user/repo/blob/commit/path/to/file.txt";
    expect(convertGithubUrlToDirectoryUrl(webUrl)).toBe(
      "https://github.com/user/repo/tree/commit/path/to",
    );
  });

  it("throws error for unsupported github url format", () => {
    expect(() =>
      convertGithubUrlToDirectoryUrl("https://github.com/user/repo"),
    ).toThrow();
  });

  it("throws error for invalid raw github url", () => {
    expect(() =>
      convertGithubUrlToDirectoryUrl(
        "https://raw.githubusercontent.com/user/repo",
      ),
    ).toThrow();
  });

  it("throws error for invalid web github url", () => {
    expect(() =>
      convertGithubUrlToDirectoryUrl(
        "https://github.com/user/repo/blob/commit/",
      ),
    ).toThrow();
  });
});

describe("getIdOrTitleFromPath", () => {
  it("returns last path segment as id if RUNS_BASE_PATH is present", () => {
    const path = "/foo/bar/runs/123";
    vi.mock("@/routes/router", () => ({
      RUNS_BASE_PATH: "/runs",
    }));
    const { id, title } = getIdOrTitleFromPath(path);
    expect(id).toBe("123");
    expect(title).toBe(undefined);
  });

  it("returns last path segment as title if RUNS_BASE_PATH is not present", () => {
    const path = "/foo/bar/other/456";
    const { id, title } = getIdOrTitleFromPath(path);
    expect(id).toBe(undefined);
    expect(title).toBe("456");
  });

  it("decodes URI components", () => {
    const path = "/foo/bar/runs/some%20id";
    const { id } = getIdOrTitleFromPath(path);
    expect(id).toBe("some id");
  });

  it("returns undefined if path ends with slash", () => {
    const path = "/foo/bar/runs/";
    const { id, title } = getIdOrTitleFromPath(path);
    expect(id).toBe(undefined);
    expect(title).toBe(undefined);
  });
});

// downloadYamlFromComponentText tests
describe("downloadYamlFromComponentText", () => {
  beforeAll(() => {
    // @ts-expect-error: global.URL may not exist in the test environment, so we mock it for testing purposes
    global.URL = {
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn(),
    };
  });

  afterAll(() => {
    // @ts-expect-error: global.URL may not exist in the test environment, so we mock it for testing purposes
    delete global.URL;
  });

  it("creates a downloadable yaml file with correct name", () => {
    const codeText = "name: testComponent\nfoo: bar";
    const displayName = "displayName";
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:url");
    const revokeObjectURLSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const appendChildSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node) => node);
    const removeChildSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation((node) => node);
    const clickSpy = vi.fn();

    vi.spyOn(document, "createElement").mockImplementation(
      () =>
        ({
          href: "",
          download: "",
          click: clickSpy,
        }) as any,
    );

    downloadYamlFromComponentText(codeText, displayName);

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:url");
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});

// converHfUrlToDirectoryUrl tests
describe("converHfUrlToDirectoryUrl", () => {
  describe("non-hf URLs", () => {
    it("returns unchanged for URLs that don't start with hf://", () => {
      expect(convertHfUrlToDirectoryUrl("https://example.com", true)).toBe(
        "https://example.com",
      );
      expect(convertHfUrlToDirectoryUrl("http://example.com", false)).toBe(
        "http://example.com",
      );
      expect(convertHfUrlToDirectoryUrl("gs://bucket/file", true)).toBe(
        "gs://bucket/file",
      );
      expect(convertHfUrlToDirectoryUrl("file:///path/to/file", false)).toBe(
        "file:///path/to/file",
      );
      expect(convertHfUrlToDirectoryUrl("", true)).toBe("");
    });
  });

  describe("directory URLs (isDirectory = true)", () => {
    it("converts hf:// dataset URL to tree URL", () => {
      const hfUrl = "hf://datasets/Ark-kun/tangle_data/path/to/directory";
      const expected =
        "https://huggingface.co/datasets/Ark-kun/tangle_data/tree/main/path/to/directory";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expected);
    });

    it("converts hf:// models URL to tree URL", () => {
      const hfUrl = "hf://models/user/bert-base-uncased/pytorch_model.bin";
      const expected =
        "https://huggingface.co/models/user/bert-base-uncased/tree/main/pytorch_model.bin";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expected);
    });

    it("converts hf:// spaces URL to tree URL", () => {
      const hfUrl = "hf://spaces/stabilityai/stable-diffusion/app.py";
      const expected =
        "https://huggingface.co/spaces/stabilityai/stable-diffusion/tree/main/app.py";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expected);
    });

    it("handles URLs with no path after repo name", () => {
      const hfUrl = "hf://datasets/user/repo";
      const expected = "https://huggingface.co/datasets/user/repo/tree/main/";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expected);
    });

    it("handles URLs with deeply nested paths", () => {
      const hfUrl = "hf://datasets/org/repo/a/b/c/d/e/file.txt";
      const expected =
        "https://huggingface.co/datasets/org/repo/tree/main/a/b/c/d/e/file.txt";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expected);
    });

    it("handles URLs with special characters in path", () => {
      const hfUrl = "hf://datasets/user/repo/path with spaces/file-name.txt";
      const expected =
        "https://huggingface.co/datasets/user/repo/tree/main/path with spaces/file-name.txt";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expected);
    });

    it("handles URLs with dots in repo name", () => {
      const hfUrl = "hf://models/facebook/bart-large-mnli.v2/config.json";
      const expected =
        "https://huggingface.co/models/facebook/bart-large-mnli.v2/tree/main/config.json";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expected);
    });
  });

  describe("file URLs (isDirectory = false)", () => {
    it("converts hf:// dataset URL to blob URL", () => {
      const hfUrl = "hf://datasets/Ark-kun/tangle_data/data/train.csv";
      const expected =
        "https://huggingface.co/datasets/Ark-kun/tangle_data/blob/main/data/train.csv";
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expected);
    });

    it("converts hf:// models URL to blob URL", () => {
      const hfUrl = "hf://models/user/gpt2/config.json";
      const expected =
        "https://huggingface.co/models/user/gpt2/blob/main/config.json";
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expected);
    });

    it("converts hf:// spaces URL to blob URL", () => {
      const hfUrl = "hf://spaces/gradio/calculator/requirements.txt";
      const expected =
        "https://huggingface.co/spaces/gradio/calculator/blob/main/requirements.txt";
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expected);
    });

    it("handles URLs with no path after repo name", () => {
      const hfUrl = "hf://datasets/user/repo";
      const expected = "https://huggingface.co/datasets/user/repo/blob/main/";
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expected);
    });

    it("handles URLs with deeply nested paths", () => {
      const hfUrl = "hf://models/org/model/tokenizer/special_tokens_map.json";
      const expected =
        "https://huggingface.co/models/org/model/blob/main/tokenizer/special_tokens_map.json";
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expected);
    });

    it("handles URLs with underscores and hyphens", () => {
      const hfUrl =
        "hf://datasets/my-org/test_dataset-v2/file_name-123.parquet";
      const expected =
        "https://huggingface.co/datasets/my-org/test_dataset-v2/blob/main/file_name-123.parquet";
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expected);
    });
  });

  describe("edge cases", () => {
    it("handles URLs with trailing slashes", () => {
      const hfUrl = "hf://datasets/user/repo/path/";
      const expectedTree =
        "https://huggingface.co/datasets/user/repo/tree/main/path/";
      const expectedBlob =
        "https://huggingface.co/datasets/user/repo/blob/main/path/";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expectedTree);
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expectedBlob);
    });

    it("handles URLs with multiple slashes in path", () => {
      const hfUrl = "hf://datasets/user/repo//path///file.txt";
      const expectedTree =
        "https://huggingface.co/datasets/user/repo/tree/main//path///file.txt";
      const expectedBlob =
        "https://huggingface.co/datasets/user/repo/blob/main//path///file.txt";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expectedTree);
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expectedBlob);
    });

    it("handles URLs with numeric usernames and repos", () => {
      const hfUrl = "hf://models/123/456/path/file.bin";
      const expectedTree =
        "https://huggingface.co/models/123/456/tree/main/path/file.bin";
      const expectedBlob =
        "https://huggingface.co/models/123/456/blob/main/path/file.bin";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expectedTree);
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expectedBlob);
    });

    it("handles URLs with single-character names", () => {
      const hfUrl = "hf://datasets/a/b/c";
      const expectedTree = "https://huggingface.co/datasets/a/b/tree/main/c";
      const expectedBlob = "https://huggingface.co/datasets/a/b/blob/main/c";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expectedTree);
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expectedBlob);
    });

    it("preserves URL encoding in paths", () => {
      const hfUrl = "hf://datasets/user/repo/file%20with%20spaces.txt";
      const expectedTree =
        "https://huggingface.co/datasets/user/repo/tree/main/file%20with%20spaces.txt";
      const expectedBlob =
        "https://huggingface.co/datasets/user/repo/blob/main/file%20with%20spaces.txt";
      expect(convertHfUrlToDirectoryUrl(hfUrl, true)).toBe(expectedTree);
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expectedBlob);
    });

    it("handles different repo types correctly", () => {
      const datasetUrl = "hf://datasets/user/repo/file";
      const modelUrl = "hf://models/user/repo/file";
      const spaceUrl = "hf://spaces/user/repo/file";

      expect(convertHfUrlToDirectoryUrl(datasetUrl, true)).toContain(
        "/datasets/",
      );
      expect(convertHfUrlToDirectoryUrl(modelUrl, true)).toContain("/models/");
      expect(convertHfUrlToDirectoryUrl(spaceUrl, true)).toContain("/spaces/");
    });

    it("handles complex organization names", () => {
      const hfUrl = "hf://models/hugging-face.co/bert-base/config.json";
      const expected =
        "https://huggingface.co/models/hugging-face.co/bert-base/blob/main/config.json";
      expect(convertHfUrlToDirectoryUrl(hfUrl, false)).toBe(expected);
    });
  });
});
