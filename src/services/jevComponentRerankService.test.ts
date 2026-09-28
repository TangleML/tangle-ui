import { afterEach, describe, expect, it, vi } from "vitest";

import { rerankComponents } from "@/services/componentRerankService";
import { rerankComponentsWithJev } from "@/services/jevComponentRerankService";
import type { RerankCandidate } from "@/services/naturalLanguageComponentSearchService";
import type { ComponentRerankConfig } from "@/types/aiProvider";

const CONFIG: ComponentRerankConfig = {
  provider: "jev",
  apiBase: "https://proxy.example.com/vendors/typesafe/v1/",
  apiKey: "test-token",
  model: "jev-1.13.0",
};
const CANDIDATES: RerankCandidate[] = [
  { id: "download", name: "Download", description: "Download a remote file" },
  { id: "upload", name: "Upload", description: "Upload a local file" },
];
const answer = (score: number, confidence = 0.8) => ({
  type: "score",
  score,
  confidence,
  probabilities: Object.fromEntries(
    [0, 1, 2, 3].map((level) => [
      String(level),
      Math.max(0, 1 - Math.abs(score - level)),
    ]),
  ),
});
const response = (answers: unknown) =>
  new Response(JSON.stringify({ answers }));

afterEach(() => vi.unstubAllGlobals());

describe("Jev component reranking", () => {
  it("uses native scores for relevance, preserves confidence separately, and binds results to provided candidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        candidate_0: answer(0, 0.99),
        candidate_1: answer(2.4, 0.2),
        invented: answer(3),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await rerankComponents(
      "upload without downloading",
      CANDIDATES,
      {
        ...CONFIG,
        reasoningEffort: "high",
      },
      { scoreAllCandidates: true },
    );

    expect(result.matches).toEqual([
      {
        id: "upload",
        score: expect.closeTo(0.8),
        confidence: 0.2,
        matchStrength: "partial",
      },
      { id: "download", score: 0, confidence: 0.99, matchStrength: "weak" },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://proxy.example.com/vendors/typesafe/v1/systemone");
    expect(init.credentials).toBe("omit");
    expect(init.headers).toEqual({
      "content-type": "application/json",
      authorization: "Bearer test-token",
    });
    const body = JSON.parse(init.body);
    expect(body.model).toBe("jev-1.13.0");
    expect(body.state).toEqual({
      query: "upload without downloading",
      candidates: { candidate_0: CANDIDATES[0], candidate_1: CANDIDATES[1] },
    });
    expect(body).not.toHaveProperty("reasoning");
    expect(body).not.toHaveProperty("input");
    expect(body.questions.candidate_1).toMatchObject({
      type: "score",
      instructions: expect.stringContaining('"candidate_1"'),
    });
    expect(body.questions.candidate_1.instructions).toContain("untrusted data");
    expect(body.questions.candidate_1.instructions).toContain("exclusion");
  });

  it("keeps the original Responses request available with its selected thinking level", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            matches: [{ id: "upload", score: 0.9, reason: "Uploads the file" }],
          }),
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await rerankComponents("upload", CANDIDATES, {
      provider: "responses",
      apiBase: "https://api.example.com/v1",
      apiKey: "original-key",
      model: "gpt-6-sol",
      reasoningEffort: "high",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.com/v1/responses",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reasoning).toEqual({
      effort: "high",
    });
    expect(result.matches[0].reason).toBe("Uploads the file");
  });

  it("does not call a provider for an empty query or candidate pool", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      rerankComponentsWithJev("  ", CANDIDATES, CONFIG),
    ).resolves.toEqual({ matches: [] });
    await expect(
      rerankComponentsWithJev("upload", [], CONFIG),
    ).resolves.toEqual({ matches: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds request size, keeps batch-local indices mapped to original ids, and sorts across batches", async () => {
    const candidates = Array.from({ length: 21 }, (_, i) => ({
      id: `id-${i}`,
      name: `component-${i}`,
      description: "fixture",
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          Object.fromEntries(
            candidates
              .slice(0, 20)
              .map((_, i) => [`candidate_${i}`, answer(1)]),
          ),
        ),
      )
      .mockResolvedValueOnce(response({ candidate_0: answer(3) }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await rerankComponentsWithJev(
      "query",
      [...candidates, candidates[0]],
      CONFIG,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      Object.keys(JSON.parse(fetchMock.mock.calls[0][1].body).state.candidates),
    ).toHaveLength(20);
    expect(
      JSON.parse(fetchMock.mock.calls[1][1].body).state.candidates,
    ).toEqual({ candidate_0: candidates[20] });
    expect(result.matches).toHaveLength(21);
    expect(result.matches[0].id).toBe("id-20");
    expect(result.matches[1]).toMatchObject({
      id: "id-0",
      score: 1 / 3,
      matchStrength: "related",
    });
  });

  it.each([
    { candidate_0: answer(2) },
    { candidate_0: answer(-1), candidate_1: answer(2) },
    { candidate_0: answer(4), candidate_1: answer(2) },
    { candidate_0: { ...answer(2), score: "2" }, candidate_1: answer(2) },
    { candidate_0: { ...answer(2), type: "choice" }, candidate_1: answer(2) },
    { candidate_0: answer(2, 2), candidate_1: answer(2) },
  ])(
    "rejects incomplete or malformed answers instead of promoting a partial ranking: %j",
    async (answers) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(answers)));
      await expect(
        rerankComponentsWithJev("upload", CANDIDATES, CONFIG),
      ).rejects.toThrow("incomplete or invalid");
    },
  );

  it("does not retry a rate limit or expose an upstream error body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("echoed-secret", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      rerankComponentsWithJev("upload", CANDIDATES, CONFIG),
    ).rejects.toThrow("Jev rate limit reached (HTTP 429).");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { "0": 0, "1": 0, "2": 0, "3": 0 },
    { "0": 0, "1": 0, "2": 1 },
    { "0": 0, "1": 0, "2": "1", "3": 0 },
  ])("rejects malformed relevance probabilities: %j", async (probabilities) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          candidate_0: { ...answer(2), probabilities },
          candidate_1: answer(2),
        }),
      ),
    );
    await expect(
      rerankComponentsWithJev("upload", CANDIDATES, CONFIG),
    ).rejects.toThrow("invalid relevance distribution");
  });

  it("does not expose a non-JSON upstream body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("echoed-private-value")),
    );
    await expect(
      rerankComponentsWithJev("upload", CANDIDATES, CONFIG),
    ).rejects.toThrow("Jev returned a non-JSON response.");
  });

  it("rejects the whole search when a later batch fails", async () => {
    const candidates = Array.from({ length: 21 }, (_, index) => ({
      id: `${index}`,
      name: "fixture",
      description: "fixture",
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          Object.fromEntries(
            candidates
              .slice(0, 20)
              .map((_, index) => [`candidate_${index}`, answer(3)]),
          ),
        ),
      )
      .mockResolvedValueOnce(new Response("Gateway timeout", { status: 504 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      rerankComponentsWithJev("upload", candidates, CONFIG),
    ).rejects.toThrow("HTTP 504");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a nonzero score without calling a likely unrelated component a useful match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          candidate_0: {
            ...answer(0.6),
            probabilities: { "0": 0.8, "1": 0, "2": 0, "3": 0.2 },
          },
          candidate_1: answer(2),
        }),
      ),
    );
    const result = await rerankComponentsWithJev("upload", CANDIDATES, CONFIG);
    expect(
      result.matches.find((match) => match.id === "download"),
    ).toMatchObject({
      score: expect.closeTo(0.2),
      matchStrength: "weak",
    });
  });

  it("preserves distinctions between related and weak candidates for an exploratory query", async () => {
    const candidates = [
      { id: "train", name: "Train a model", description: "Train a classifier" },
      {
        id: "taxi",
        name: "Taxi trips dataset",
        description: "Historical taxi trip data",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          candidate_0: answer(0.09),
          candidate_1: answer(1.2),
        }),
      ),
    );
    const result = await rerankComponentsWithJev(
      "I want to take a trip",
      candidates,
      CONFIG,
    );
    expect(result.matches).toMatchObject([
      { id: "taxi", score: expect.closeTo(0.4), matchStrength: "related" },
      { id: "train", score: expect.closeTo(0.03), matchStrength: "weak" },
    ]);
  });

  it.each([
    [3, "strong"],
    [2, "partial"],
    [1, "related"],
    [0, "weak"],
  ] as const)(
    "labels rubric grade %s as %s without treating confidence as relevance",
    async (score, matchStrength) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(response({ candidate_0: answer(score, 0.1) })),
      );
      const result = await rerankComponentsWithJev(
        "upload",
        [CANDIDATES[1]],
        CONFIG,
      );
      expect(result.matches[0]).toMatchObject({
        score: score / 3,
        matchStrength,
        confidence: 0.1,
      });
    },
  );

  it("does not continue with later batches after cancellation", async () => {
    const controller = new AbortController();
    const candidates = Array.from({ length: 21 }, (_, i) => ({
      id: `${i}`,
      name: "fixture",
      description: "fixture",
    }));
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      expect(init.signal.aborted).toBe(false);
      controller.abort();
      expect(init.signal.aborted).toBe(true);
      return response(
        Object.fromEntries(
          candidates.slice(0, 20).map((_, i) => [`candidate_${i}`, answer(1)]),
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      rerankComponentsWithJev("upload", candidates, {
        ...CONFIG,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a provider-prefixed model before sending data", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      rerankComponentsWithJev("upload", CANDIDATES, {
        ...CONFIG,
        model: "typesafe:jev-latest",
      }),
    ).rejects.toThrow("bare Jev model name");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
