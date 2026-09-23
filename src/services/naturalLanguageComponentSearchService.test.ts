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

function mockResponsesResponse(content: unknown, status = 200) {
  return new Response(
    JSON.stringify({
      output_text: JSON.stringify(content),
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

  it("includes input/output types, descriptions, and source when present", () => {
    const ref: ComponentReference = {
      digest: "abc",
      spec: {
        name: "train",
        description: "",
        inputs: [
          {
            name: "dataset",
            type: "Dataset",
            description: "Training data",
          },
        ],
        outputs: [
          {
            name: "model",
            type: { Model: { format: "xgboost" } },
            description: "Trained model",
          },
        ],
        implementation: { container: { image: "x" } },
      },
    };
    expect(
      componentReferenceToCandidate(ref, {
        kind: "published",
        label: "Published",
        id: "published",
      }),
    ).toEqual({
      id: "abc",
      name: "train",
      description: "",
      source: { kind: "published", label: "Published" },
      inputs: [
        {
          name: "dataset",
          type: "Dataset",
          description: "Training data",
        },
      ],
      outputs: [
        {
          name: "model",
          type: '{"Model":{"format":"xgboost"}}',
          description: "Trained model",
        },
      ],
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

  it("throws NaturalLanguageSearchConfigError when API base is missing", async () => {
    await expect(
      rerankComponentsByNaturalLanguage(
        "train",
        [{ id: "a", name: "n", description: "d" }],
        { ...VALID_OPTIONS, apiBase: "" },
      ),
    ).rejects.toBeInstanceOf(NaturalLanguageSearchConfigError);
  });

  it("omits authorization and model when API key and model are blank", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponsesResponse({ matches: [] }),
    );

    await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "n", description: "d" }],
      { ...VALID_OPTIONS, apiKey: "", model: "" },
    );

    const call = vi.mocked(global.fetch).mock.calls[0];
    const init = call?.[1];
    const body = parseFetchBody(call);
    expect(body.model).toBeUndefined();
    expect(body).not.toHaveProperty("max_output_tokens");
    expect(JSON.stringify(init)).not.toContain("authorization");
  });

  it("includes login cookies when using the Tangle proxy", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponsesResponse({ matches: [] }),
    );

    await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "n", description: "d" }],
      {
        ...VALID_OPTIONS,
        apiBase: "https://backend.example.com/api/experimental/ai/v1",
        apiKey: "",
        backendAuth: { token: "backend-token" },
      },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://backend.example.com/api/experimental/ai/v1/responses",
      expect.objectContaining({ credentials: "include" }),
    );
    const backendCall = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(backendCall?.[1]?.headers).get("authorization")).toBe(
      "Bearer backend-token",
    );

    vi.mocked(fetch).mockResolvedValue(mockResponsesResponse({ matches: [] }));
    await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "n", description: "d" }],
      VALID_OPTIONS,
    );
    const manualCall = vi.mocked(fetch).mock.calls[1];
    expect(manualCall?.[1]?.body).toBe(backendCall?.[1]?.body);
    expect(manualCall?.[1]?.credentials).toBe("omit");
    expect(new Headers(manualCall?.[1]?.headers).get("authorization")).toBe(
      "Bearer sk-test",
    );
  });

  it("filters out hallucinated ids the model returned", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponsesResponse({
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

  it.each([401, 403, 404, 502])(
    "surfaces backend status %s without falling back",
    async (status) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response("AI unavailable", { status }),
      );
      await expect(
        rerankComponentsByNaturalLanguage(
          "train",
          [{ id: "a", name: "a", description: "" }],
          {
            ...VALID_OPTIONS,
            backendAuth: { token: "login-token" },
            apiBase: "https://backend.example.com/api/experimental/ai/v1",
          },
        ),
      ).rejects.toThrow(`LLM proxy returned ${status}`);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["", '{"matches":[{"id":"a","score":1,"reason":"partial"}]}'])(
    "rejects incomplete output: %s",
    async (output_text) => {
      vi.mocked(fetch).mockResolvedValue(
        Response.json({
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output_text,
        }),
      );
      await expect(
        rerankComponentsByNaturalLanguage(
          "train",
          [{ id: "a", name: "a", description: "" }],
          VALID_OPTIONS,
        ),
      ).rejects.toThrow("AI response reached the provider's output limit");
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("recovers matches from malformed JSON regardless of field order", async () => {
    // `output_text` is not valid JSON, so the service falls back to partial
    // parsing. Fields are deliberately ordered score/reason/id to prove the
    // recovery does not depend on a fixed id/score/reason order.
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text:
            'here are the matches: {"score": 0.9, "reason": "strong fit", "id": "a"} {"reason": "weaker", "id": "b", "score": 0.4} (truncated',
        }),
        { status: 200, statusText: "OK" },
      ),
    );

    const result = await rerankComponentsByNaturalLanguage(
      "train",
      [
        { id: "a", name: "a", description: "" },
        { id: "b", name: "b", description: "" },
      ],
      VALID_OPTIONS,
    );

    expect(result.matches).toEqual([
      { id: "a", score: 0.9, reason: "strong fit" },
      { id: "b", score: 0.4, reason: "weaker" },
    ]);
  });

  it("clamps out-of-range score values into [0, 1]", async () => {
    // NaN scores are intentionally not tested here: JSON.stringify({score: NaN})
    // serializes to `null`, which never reaches `normalizeScore` because
    // `isValidMatch` rejects it upstream.
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponsesResponse({
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
      mockResponsesResponse({ matches: "not an array" }),
    );

    const result = await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "trainer", description: "" }],
      VALID_OPTIONS,
    );
    expect(result.matches).toEqual([]);
    expect(result.rawContent).toContain("not an array");
  });

  it("uses the Responses API for component search generation", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponsesResponse({ matches: [] }),
    );

    await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "a", description: "" }],
      VALID_OPTIONS,
    );

    const call = vi.mocked(global.fetch).mock.calls[0];
    const body = parseFetchBody(call);
    expect(call?.[0]).toBe("https://api.example.com/v1/responses");
    expect(body.instructions).toContain("reranker");
    expect(body.input).toContain("Query: train");
    expect(body.text).toEqual({ format: { type: "json_object" } });
    expect(body).not.toHaveProperty("max_output_tokens");
    expect(body.max_tokens).toBeUndefined();
    expect(body.max_completion_tokens).toBeUndefined();
    // Non-reasoning model: temperature pinned for deterministic ordering.
    expect(body.temperature).toBe(0);
  });

  it("defaults to returning only the strongest candidates", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponsesResponse({ matches: [] }),
    );

    await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "a", description: "" }],
      VALID_OPTIONS,
    );

    const body = parseFetchBody(vi.mocked(global.fetch).mock.calls[0]);
    expect(body.instructions).toContain("at most the 20 strongest");
    expect(body.instructions).not.toContain("Score EVERY candidate");
  });

  it("scores every candidate without imposing a frontend token cap", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponsesResponse({ matches: [] }),
    );

    const candidates = Array.from({ length: 40 }, (_, i) => ({
      id: `c${i}`,
      name: `c${i}`,
      description: "",
    }));
    await rerankComponentsByNaturalLanguage(
      "train",
      candidates,
      VALID_OPTIONS,
      {
        scoreAllCandidates: true,
      },
    );

    const body = parseFetchBody(vi.mocked(global.fetch).mock.calls[0]);
    expect(body.instructions).toContain("Score EVERY candidate");
    expect(body.instructions).not.toContain("at most the 20 strongest");
    expect(body).not.toHaveProperty("max_output_tokens");
  });

  it.each([
    "gpt-5-mini",
    "gpt-5.6-sol",
    "gpt-6-sol",
    "gpt-6-astra",
    "openai:gpt-6-astra",
  ])("omits temperature for %s", async (model) => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponsesResponse({ matches: [] }),
    );

    await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "a", description: "" }],
      { ...VALID_OPTIONS, model },
    );

    const body = parseFetchBody(vi.mocked(global.fetch).mock.calls[0]);
    expect(body.model).toBe(model);
    expect(body.temperature).toBeUndefined();
  });

  it("leaves output limits to the provider when model is blank", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponsesResponse({ matches: [] }),
    );

    await rerankComponentsByNaturalLanguage(
      "train",
      [{ id: "a", name: "a", description: "" }],
      { ...VALID_OPTIONS, model: "" },
    );

    const call = vi.mocked(global.fetch).mock.calls[0];
    const body = parseFetchBody(call);
    expect(body.model).toBeUndefined();
    expect(body).not.toHaveProperty("max_output_tokens");
    // Blank model: proxy owns selection, so we send no temperature.
    expect(body.temperature).toBeUndefined();
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
      mockResponsesResponse({
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
    expect(call?.[0]).toBe("https://api.example.com/v1/responses");
    expect(JSON.stringify(body.input)).toContain("train_model");
    expect(JSON.stringify(body.input)).toContain("dataset");
  });

  it("requires a hydrated component spec", async () => {
    await expect(
      generateComponentAiDescription({ digest: "abc" }, VALID_OPTIONS),
    ).rejects.toThrow("Component details are not loaded yet");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws when the model returns an empty description", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponsesResponse({ description: "" }),
    );

    await expect(
      generateComponentAiDescription(reference, VALID_OPTIONS),
    ).rejects.toThrow("empty description");
  });

  it("uses backend auth for descriptions and preserves cancellation", async () => {
    const controller = new AbortController();
    vi.mocked(fetch).mockImplementation((_input, init) => {
      expect(init?.signal).toBe(controller.signal);
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer login-token",
      );
      return new Promise((_resolve, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(controller.signal.reason),
        );
      });
    });
    const pending = generateComponentAiDescription(reference, {
      ...VALID_OPTIONS,
      backendAuth: { token: "login-token" },
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
