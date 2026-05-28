import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentReference } from "@/utils/componentSpec";
import { isRecord } from "@/utils/typeGuards";

import {
  componentReferenceToCandidate,
  generateComponentAiDescription,
  NaturalLanguageSearchConfigError,
  rerankComponentsByNaturalLanguage,
} from "./naturalLanguageComponentSearchService";

const VALID_OPTIONS = {
  apiBase: "https://api.example.com/v1",
  apiKey: "sk-test",
  model: "gpt-4o-mini",
};

function mockChatResponse(content: unknown, status = 200) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
    {
      status,
      statusText: status === 200 ? "OK" : "Internal Server Error",
    },
  );
}

function parseFetchBody(call: unknown[] | undefined): Record<string, unknown> {
  const init = call?.[1];
  if (
    typeof init !== "object" ||
    init === null ||
    !("body" in init) ||
    typeof init.body !== "string"
  ) {
    throw new Error("Expected fetch body to be a string");
  }
  const { body } = init;
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed)) {
    throw new Error("Expected fetch body to be an object");
  }
  return parsed;
}

describe("componentReferenceToCandidate", () => {
  it("returns null for references without a digest", () => {
    const ref: ComponentReference = {
      spec: {
        name: "no_digest",
        inputs: [],
        outputs: [],
        implementation: { container: { image: "x" } },
      },
    };
    expect(componentReferenceToCandidate(ref)).toBeNull();
  });

  it("returns null when the reference has no useful metadata", () => {
    const ref: ComponentReference = {
      digest: "abc",
      spec: {
        inputs: [],
        outputs: [],
        implementation: { container: { image: "x" } },
      },
    };
    expect(componentReferenceToCandidate(ref)).toBeNull();
  });

  it("omits empty inputs/outputs from the candidate", () => {
    const ref: ComponentReference = {
      digest: "abc",
      spec: {
        name: "train",
        description: "trainer",
        inputs: [],
        outputs: [],
        implementation: { container: { image: "x" } },
      },
    };
    const candidate = componentReferenceToCandidate(ref);
    expect(candidate).toEqual({
      id: "abc",
      name: "train",
      description: "trainer",
    });
  });

  it("includes input/output names when present", () => {
    const ref: ComponentReference = {
      digest: "abc",
      spec: {
        name: "train",
        description: "",
        inputs: [{ name: "dataset" }],
        outputs: [{ name: "model" }],
        implementation: { container: { image: "x" } },
      },
    };
    expect(componentReferenceToCandidate(ref)).toEqual({
      id: "abc",
      name: "train",
      description: "",
      inputs: ["dataset"],
      outputs: ["model"],
    });
  });
});

describe("rerankComponentsByNaturalLanguage", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty result for an empty query", async () => {
    const result = await rerankComponentsByNaturalLanguage(
      "",
      [{ id: "a", name: "n", description: "d" }],
      VALID_OPTIONS,
    );
    expect(result.matches).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty result when no candidates are provided", async () => {
    const result = await rerankComponentsByNaturalLanguage(
      "train",
      [],
      VALID_OPTIONS,
    );
    expect(result.matches).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws NaturalLanguageSearchConfigError when API base or key is missing", async () => {
    await expect(
      rerankComponentsByNaturalLanguage(
        "train",
        [{ id: "a", name: "n", description: "d" }],
        { ...VALID_OPTIONS, apiKey: "" },
      ),
    ).rejects.toBeInstanceOf(NaturalLanguageSearchConfigError);

    await expect(
      rerankComponentsByNaturalLanguage(
        "train",
        [{ id: "a", name: "n", description: "d" }],
        { ...VALID_OPTIONS, apiBase: "" },
      ),
    ).rejects.toBeInstanceOf(NaturalLanguageSearchConfigError);
  });

  it("throws NaturalLanguageSearchConfigError when model is missing", async () => {
    await expect(
      rerankComponentsByNaturalLanguage(
        "train",
        [{ id: "a", name: "n", description: "d" }],
        { ...VALID_OPTIONS, model: "" },
      ),
    ).rejects.toBeInstanceOf(NaturalLanguageSearchConfigError);
  });

  it("filters out hallucinated ids the model returned", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockChatResponse({
        matches: [
          { id: "a", score: 0.9, reason: "best fit" },
          { id: "ghost", score: 0.8, reason: "made up" },
        ],
      }),
    );

    const result = await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "trainer", description: "" }],
      VALID_OPTIONS,
    );
    expect(result.matches.map((m) => m.id)).toEqual(["a"]);
  });

  it("clamps out-of-range score values into [0, 1]", async () => {
    // NaN scores are intentionally not tested here: JSON.stringify({score: NaN})
    // serializes to `null`, which never reaches `normalizeScore` because
    // `isValidMatch` rejects it upstream.
    vi.mocked(global.fetch).mockResolvedValue(
      mockChatResponse({
        matches: [
          { id: "a", score: 1.5, reason: "over" },
          { id: "b", score: -0.4, reason: "under" },
        ],
      }),
    );

    const result = await rerankComponentsByNaturalLanguage(
      "train",
      [
        { id: "a", name: "a", description: "" },
        { id: "b", name: "b", description: "" },
      ],
      VALID_OPTIONS,
    );
    const byId = Object.fromEntries(result.matches.map((m) => [m.id, m.score]));
    expect(byId.a).toBe(1);
    expect(byId.b).toBe(0);
  });

  it("returns empty matches when the response shape is wrong, but keeps raw content", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockChatResponse({ matches: "not an array" }),
    );

    const result = await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "trainer", description: "" }],
      VALID_OPTIONS,
    );
    expect(result.matches).toEqual([]);
    expect(result.rawContent).toContain("not an array");
  });

  it("uses max_completion_tokens for gpt-5 / o-series models", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockChatResponse({ matches: [] }),
    );

    await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "a", description: "" }],
      { ...VALID_OPTIONS, model: "gpt-5-mini" },
    );

    const call = vi.mocked(global.fetch).mock.calls[0];
    const body = parseFetchBody(call);
    expect(body.max_completion_tokens).toBeDefined();
    expect(body.max_tokens).toBeUndefined();
    expect(body.temperature).toBeUndefined();
  });

  it("uses max_tokens and temperature for non-reasoning models", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockChatResponse({ matches: [] }),
    );

    await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "a", description: "" }],
      VALID_OPTIONS,
    );

    const call = vi.mocked(global.fetch).mock.calls[0];
    const body = parseFetchBody(call);
    expect(body.max_tokens).toBeDefined();
    expect(body.max_completion_tokens).toBeUndefined();
    expect(body.temperature).toBe(0);
  });
});

describe("generateComponentAiDescription", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const reference: ComponentReference = {
    digest: "abc",
    spec: {
      name: "train_model",
      description: "Trains a model.",
      inputs: [{ name: "dataset", description: "Training data" }],
      outputs: [{ name: "model", description: "Trained model" }],
      implementation: {
        container: {
          image: "python:3.12",
          command: ["python", "train.py"],
        },
      },
    },
  };

  it("generates a description from a component spec", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockChatResponse({
        description:
          "This component trains a model from the dataset input and writes the trained model output.",
      }),
    );

    const result = await generateComponentAiDescription(
      reference,
      VALID_OPTIONS,
    );

    expect(result.description).toContain("trains a model");
    const call = vi.mocked(global.fetch).mock.calls[0];
    const body = parseFetchBody(call);
    const serializedMessages = JSON.stringify(body.messages);
    expect(serializedMessages).toContain("train_model");
    expect(serializedMessages).toContain("dataset");
  });

  it("requires a hydrated component spec", async () => {
    await expect(
      generateComponentAiDescription({ digest: "abc" }, VALID_OPTIONS),
    ).rejects.toThrow("Component details are not loaded yet");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws when the model returns an empty description", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockChatResponse({ description: "" }),
    );

    await expect(
      generateComponentAiDescription(reference, VALID_OPTIONS),
    ).rejects.toThrow("empty description");
  });
});
