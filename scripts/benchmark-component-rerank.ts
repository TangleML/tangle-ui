import { createHash, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

import { getComponentSearchConfig } from "../src/config/componentSearch";
import { rerankComponents } from "../src/services/componentRerankService";
import type { RerankResult } from "../src/services/naturalLanguageComponentSearchService";
import type {
  AiReasoningEffort,
  ComponentRerankConfig,
} from "../src/types/aiProvider";
import { isRecord } from "../src/utils/typeGuards";
import {
  benchmarkCandidates,
  COMPONENT_RERANK_CASES,
  type RerankBenchmarkCase,
} from "./benchmarks/componentRerankCases";

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    repeats: { type: "string", default: "3" },
    cases: { type: "string" },
    "run-id": { type: "string" },
  },
});
const runId = values["run-id"] ?? randomUUID();
const repeats = Number(values.repeats);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20)
  throw new Error("--repeats must be between 1 and 20");
const selectedIds = values.cases?.split(",");
const cases = COMPONENT_RERANK_CASES.filter(
  (testCase) => !selectedIds || selectedIds.includes(testCase.id),
);
if (
  !cases.length ||
  selectedIds?.some((id) => !cases.some((testCase) => testCase.id === id))
)
  throw new Error("Unknown benchmark case");

function reasoningEffort(value: string): AiReasoningEffort {
  if (
    value === "none" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max"
  )
    return value;
  throw new Error("Unsupported RERANK_BENCH_REASONING_EFFORT");
}

const baseline: ComponentRerankConfig = {
  provider: "responses",
  apiBase:
    process.env.RERANK_BENCH_API_BASE ?? process.env.VITE_OPENAI_API_BASE ?? "",
  apiKey:
    process.env.RERANK_BENCH_API_KEY ?? process.env.VITE_OPENAI_API_KEY ?? "",
  model: process.env.RERANK_BENCH_RESPONSES_MODEL ?? "gpt-6-sol",
  reasoningEffort: reasoningEffort(
    process.env.RERANK_BENCH_REASONING_EFFORT ?? "high",
  ),
};
const configurations: ComponentRerankConfig[] = [
  baseline,
  {
    ...getComponentSearchConfig(baseline),
    model: process.env.RERANK_BENCH_JEV_MODEL ?? "jev-1.13.0",
  },
];

const rawHeaders: unknown = JSON.parse(
  process.env.RERANK_BENCH_HEADERS ?? "{}",
);
if (
  !isRecord(rawHeaders) ||
  !Object.values(rawHeaders).every((value) => typeof value === "string")
)
  throw new Error(
    "RERANK_BENCH_HEADERS must be an object of string header values",
  );
const extraHeaders = new Headers();
for (const [key, value] of Object.entries(rawHeaders))
  if (typeof value === "string") extraHeaders.set(key, value);

function mean(values: number[]): number | null {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
}

function quality(testCase: RerankBenchmarkCase, result: RerankResult) {
  const matches = result.matches.filter((match) => match.score > 0.01);
  const topFive = matches.slice(0, 5);
  const grades = Object.values(testCase.relevance);
  const ideal = grades.sort((a, b) => b - a).slice(0, 5);
  const dcg = (values: number[]) =>
    values.reduce(
      (sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2),
      0,
    );
  const idealDcg = dcg(ideal);
  const firstRelevant = matches.findIndex(
    (match) => (testCase.relevance[match.id] ?? 0) > 0,
  );
  return {
    ndcgAt5: idealDcg
      ? dcg(topFive.map((match) => testCase.relevance[match.id] ?? 0)) /
        idealDcg
      : null,
    reciprocalRank: idealDcg
      ? firstRelevant < 0
        ? 0
        : 1 / (firstRelevant + 1)
      : null,
    topOneRelevant: idealDcg
      ? matches[0] && (testCase.relevance[matches[0].id] ?? 0) > 0
        ? 1
        : 0
      : null,
    noMatchCorrect: idealDcg
      ? null
      : !result.matches.some((match) =>
          match.matchStrength
            ? match.matchStrength === "strong" ||
              match.matchStrength === "partial"
            : match.score > 0.01,
        ),
    excludedAboveThreshold:
      testCase.excluded?.filter((id) =>
        matches.some((match) => match.id === id),
      ).length ?? null,
    excludedInTop5:
      testCase.excluded?.filter((id) =>
        topFive.some((match) => match.id === id),
      ).length ?? null,
  };
}

interface Sample {
  provider: ComponentRerankConfig["provider"];
  case: string;
  repeat: number;
  candidateCount: number;
  elapsedMs: number;
  status: "ok" | "error";
  model: string;
  returnedModels: string[];
  reasoningEffort?: AiReasoningEffort;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reportedUsageRequests: number;
  quality?: ReturnType<typeof quality>;
  topFive?: { id: string; score: number }[];
  error?: string;
}

const originalFetch = globalThis.fetch;
async function runCase(
  testCase: RerankBenchmarkCase,
  repeat: number,
  config: ComponentRerankConfig,
): Promise<Sample> {
  let requests = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let reportedUsageRequests = 0;
  const returnedModels = new Set<string>();
  const payloads: Promise<void>[] = [];
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    extraHeaders.forEach((value, key) => headers.set(key, value));
    requests += 1;
    const response = await originalFetch(input, { ...init, headers });
    payloads.push(
      response
        .clone()
        .json()
        .then((payload: unknown) => {
          if (!isRecord(payload)) return;
          if (typeof payload.model === "string")
            returnedModels.add(payload.model);
          const usage = payload.usage;
          if (!isRecord(usage)) return;
          if (typeof usage.input_tokens === "number") {
            reportedUsageRequests += 1;
            inputTokens += usage.input_tokens;
          }
          if (typeof usage.output_tokens === "number")
            outputTokens += usage.output_tokens;
          if (
            isRecord(usage.input_tokens_details) &&
            typeof usage.input_tokens_details.cached_tokens === "number"
          )
            cachedInputTokens += usage.input_tokens_details.cached_tokens;
        })
        .catch(() => {}),
    );
    return response;
  };
  const fixtureCandidates = benchmarkCandidates(testCase, repeat);
  const originalIds = new Map<string, string>();
  const candidates = fixtureCandidates.map((candidate) => {
    const id = createHash("sha256")
      .update(`${runId}:${testCase.id}:${repeat}:${candidate.id}`)
      .digest("hex");
    originalIds.set(id, candidate.id);
    return { ...candidate, id };
  });
  const started = performance.now();
  let result: RerankResult | undefined;
  let failed = false;
  let errorMessage = "";
  try {
    result = await rerankComponents(
      testCase.query,
      candidates,
      { ...config, signal: AbortSignal.timeout(120_000) },
      { scoreAllCandidates: true },
    );
    result = {
      ...result,
      matches: result.matches.map((match) => ({
        ...match,
        id: originalIds.get(match.id) ?? match.id,
      })),
    };
  } catch (error) {
    failed = true;
    errorMessage = error instanceof Error ? error.message : "Request failed";
    for (const credential of configurations
      .map((item) => item.apiKey)
      .filter(Boolean))
      errorMessage = errorMessage.replaceAll(credential, "[redacted]");
    extraHeaders.forEach((value) => {
      if (value) errorMessage = errorMessage.replaceAll(value, "[redacted]");
    });
    errorMessage = errorMessage
      .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
      .slice(0, 300);
  } finally {
    globalThis.fetch = originalFetch;
  }
  const elapsedMs = Math.round(performance.now() - started);
  await Promise.all(payloads);
  return {
    provider: config.provider,
    case: testCase.id,
    repeat: repeat + 1,
    candidateCount: candidates.length,
    elapsedMs,
    status: failed ? "error" : "ok",
    model: config.model,
    returnedModels: [...returnedModels],
    ...(config.reasoningEffort
      ? { reasoningEffort: config.reasoningEffort }
      : {}),
    requests,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    reportedUsageRequests,
    ...(result
      ? {
          quality: quality(testCase, result),
          topFive: result.matches
            .slice(0, 5)
            .map(({ id, score }) => ({ id, score })),
        }
      : { error: errorMessage }),
  };
}

function summary(
  provider: ComponentRerankConfig["provider"],
  samples: Sample[],
) {
  const runs = samples.filter((sample) => sample.provider === provider);
  const successful = runs.filter((sample) => sample.status === "ok");
  const measured = (key: "ndcgAt5" | "reciprocalRank" | "topOneRelevant") =>
    successful.flatMap((sample) =>
      typeof sample.quality?.[key] === "number" ? [sample.quality[key]] : [],
    );
  const noMatch = successful.filter(
    (sample) => sample.quality?.noMatchCorrect !== null,
  );
  const excluded = successful.filter(
    (sample) => sample.quality?.excludedAboveThreshold !== null,
  );
  const total = (
    key:
      | "inputTokens"
      | "outputTokens"
      | "cachedInputTokens"
      | "requests"
      | "reportedUsageRequests",
  ) => runs.reduce((sum, sample) => sum + sample[key], 0);
  return {
    provider,
    samples: runs.length,
    successful: successful.length,
    errors: runs.length - successful.length,
    medianMs: percentile(
      successful.map((sample) => sample.elapsedMs),
      0.5,
    ),
    p95Ms: percentile(
      successful.map((sample) => sample.elapsedMs),
      0.95,
    ),
    meanNdcgAt5: mean(measured("ndcgAt5")),
    meanReciprocalRank: mean(measured("reciprocalRank")),
    topOneAccuracy: mean(measured("topOneRelevant")),
    noMatchAccuracy: mean(
      noMatch.map((sample) => (sample.quality?.noMatchCorrect ? 1 : 0)),
    ),
    exclusionCases: excluded.length,
    meanExcludedInTop5: mean(
      excluded.map((sample) => sample.quality?.excludedInTop5 ?? 0),
    ),
    meanExcludedAboveThreshold: mean(
      excluded.map((sample) => sample.quality?.excludedAboveThreshold ?? 0),
    ),
    requests: total("requests"),
    reportedUsageRequests: total("reportedUsageRequests"),
    inputTokens: total("inputTokens"),
    outputTokens: total("outputTokens"),
    cachedInputTokens: total("cachedInputTokens"),
    ...(provider === "jev" &&
    total("reportedUsageRequests") === total("requests")
      ? { estimatedListCostUsd: (total("inputTokens") * 0.042) / 1_000_000 }
      : {}),
  };
}

console.log(
  JSON.stringify({
    type: "benchmark",
    fixture: "synthetic-component-search-v1",
    scoring: "continuous-rubric-with-match-labels",
    runId,
    timestamp: new Date().toISOString(),
    repeats,
    cases: cases.map(({ id, candidates }) => ({
      id,
      candidates: candidates.length,
    })),
    models: configurations.map(({ provider, model, reasoningEffort }) => ({
      provider,
      model,
      reasoningEffort,
    })),
    note: "Reranking only; identical candidates and order per pair, alternating provider order. Fresh opaque candidate IDs per run/case/repetition avoid exact-request response cache reuse. No retries, no warmup, no output files. Quality labels are handwritten; small synthetic evaluation, not production accuracy. Jev retains continuous normalized rubric scores for ordering and separate match labels. Exclusion diagnostics use a numeric cutoff of 0.01; no-match correctness uses Jev strong/partial labels or the original provider cutoff. Scores are not confidence.",
  }),
);

if (values["dry-run"]) {
  for (const testCase of cases) {
    const ids = new Set(testCase.candidates.map((candidate) => candidate.id));
    if (ids.size !== testCase.candidates.length)
      throw new Error(`Duplicate candidate in ${testCase.id}`);
    for (const id of [
      ...Object.keys(testCase.relevance),
      ...(testCase.excluded ?? []),
    ])
      if (!ids.has(id))
        throw new Error(`Unknown label ${id} in ${testCase.id}`);
    const ideal = Object.entries(testCase.relevance)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ({ id, score: 1, reason: "" }));
    const metrics = quality(testCase, { matches: ideal });
    if (ideal.length && metrics.ndcgAt5 !== 1)
      throw new Error(`Invalid ideal ranking metric in ${testCase.id}`);
  }
  console.log(
    JSON.stringify({
      type: "dry-run",
      status: "passed",
      cases: cases.length,
      networkRequests: 0,
    }),
  );
} else {
  if (configurations.some((config) => !config.apiBase))
    throw new Error(
      "Set RERANK_BENCH_API_BASE or VITE_OPENAI_API_BASE for the shared proxy. API keys and optional headers are read only from environment variables.",
    );
  const samples: Sample[] = [];
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    for (const [index, testCase] of cases.entries()) {
      const order =
        (repeat + index) % 2 ? [...configurations].reverse() : configurations;
      for (const config of order) {
        const sample = await runCase(testCase, repeat, config);
        samples.push(sample);
        console.log(JSON.stringify({ type: "sample", ...sample }));
      }
    }
  }
  for (const config of configurations)
    console.log(
      JSON.stringify({ type: "summary", ...summary(config.provider, samples) }),
    );
  if (samples.some((sample) => sample.status === "error")) process.exitCode = 1;
}
