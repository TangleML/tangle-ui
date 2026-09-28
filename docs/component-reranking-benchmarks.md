# Component reranking benchmarks

The benchmark calls the same provider implementations used by component search. It compares the original Responses-based reranker (default: `gpt-6-sol`, High thinking) against native Jev (default: pinned `jev-1.13.0`). It does not change either prompt, use a surrogate model, or measure lexical retrieval or embedding latency.

The handwritten fixtures cover exact operations, semantic paraphrases, exclusions, input/output requirements, multi-component requests, missing metadata, no usable match, and adversarial component text. Each query supplies 24–25 synthetic component summaries. No private libraries or user data are loaded.

## Run

Prerequisites: Node.js and the repository's existing dependencies, plus access to both provider endpoints. Run a non-network fixture check first:

```sh
pnpm run benchmark:component-rerank --dry-run
```

Configure these environment variables outside version control:

| Variable                        | Meaning                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `VITE_OPENAI_API_BASE`          | Shared AI proxy base, without `/responses`; Jev's vendor route is derived from this base |
| `VITE_OPENAI_API_KEY`           | Shared proxy token; optional for a proxy that needs no token                             |
| `RERANK_BENCH_API_BASE`         | Optional benchmark override of the shared proxy base                                     |
| `RERANK_BENCH_API_KEY`          | Optional benchmark override of the shared token                                          |
| `RERANK_BENCH_RESPONSES_MODEL`  | Optional baseline model override                                                         |
| `RERANK_BENCH_REASONING_EFFORT` | Optional baseline thinking level override                                                |
| `RERANK_BENCH_JEV_MODEL`        | Optional Jev model override                                                              |
| `RERANK_BENCH_HEADERS`          | Optional JSON object of headers required by your proxy; applied to both endpoints        |

The benchmark reads exported environment variables; it does not load `.env` automatically or have access to the browser's authenticated session. Both providers share one connection, using the same vendor-route resolver as the UI.

```sh
pnpm run benchmark:component-rerank --repeats 3
```

To select cases, add `--cases semantic-paraphrase,no-match`. For environments that disallow the `tsx` CLI's IPC socket, the equivalent non-caching command is:

```sh
TSX_DISABLE_CACHE=1 node --import tsx scripts/benchmark-component-rerank.ts --repeats 3
```

Each run prints JSON lines for its configuration, individual samples, and per-provider summaries. It writes no benchmark artifacts. Credentials are read from the environment and are excluded from the printed configuration. Network failures produce error samples, and the command exits unsuccessfully if any requests failed.

## Method

Both providers receive identical candidates in identical order for each pair, with `scoreAllCandidates: true` as used by search. Provider order alternates. Candidate order rotates between repetitions. Fresh opaque candidate IDs are derived from a run identifier, the case, and the repetition to prevent reuse of identical pilot requests by a response cache. `--run-id` can replay an identifier, but replayed requests may be cached. The actual responding model and reported token usage are recorded. There is no warmup or retry.

Latency includes all batches, network time, and response parsing. Summaries report median and p95 for successful searches and a separate failure count. A 24-candidate Jev search uses two requests; the original reranker uses one. Larger production candidate pools can behave differently. Token counts include reported usage from completed requests even when a later batch fails. Provider-reported cached input tokens are separate from whole-response caching.

Quality uses handwritten relevance grades: direct fit (3), useful partial fit (2), weakly related (1), and irrelevant (0). NDCG@5 measures how close the first five positive-scored results are to the ideal graded order; reciprocal rank measures how early the first relevant result appears. Top-one accuracy is reported separately. No-match cases check whether Jev labels any candidate as a strong or partial match (the original provider retains its score > 0.01 rule); they are excluded from ranking averages. Exclusion counts show how many forbidden candidates appear above a numeric diagnostic cutoff of 0.01 and in the first five positive-scored results. The UI retains lexical results, including candidates without positive AI relevance, so these metrics do not imply that unrelated results disappear from search.

Jev retains the continuous normalized rubric score for ordering and uses qualitative match labels for presentation. Confidence is not used as relevance. Runs identify this scoring policy as `continuous-rubric-with-match-labels`; historical runs that zeroed weaker scores are not directly comparable for quality metrics. The Responses baseline retains its original scoring behavior. Token counts are not dollar costs: the providers have different rates. The Jev estimate uses the published $0.042 per million input tokens and free output, and is shown only when every request reports usage. Baseline cost is deliberately not guessed.

This is a small synthetic regression benchmark, not a production accuracy claim. Some fixtures also serve as integration smoke tests. Review individual cases, uncertainty, and failure rates when evaluating search quality.
