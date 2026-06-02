import type {
  ExperimentIdea,
  TangentPipeline,
  TeamStats,
} from "@/routes/tangent/types";

const CURRENT_USER_NAME = "you";

const daysAgo = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const tangentIdea = (
  idea: Omit<ExperimentIdea, "source"> &
    Partial<Pick<ExperimentIdea, "source">>,
): ExperimentIdea => ({ source: "tangent", ...idea });

const humanIdea = (
  idea: Omit<ExperimentIdea, "source" | "impact">,
): ExperimentIdea => ({ source: "human", ...idea });

const queryEncoderPipeline: TangentPipeline = {
  runId: "019db6c661691a51840d",
  name: "Query Encoder Distillation",
  ownerEmail: "rin.tanaka@shopify.com",
  runStatus: "succeeded",
  lastRunAt: daysAgo(1),
  metricName: "ndcg@10",
  metricValue: 0.6421,
  baselineValue: 0.619,
  metricDeltaPct: 3.7,
  scenarioStatus: "results_available",
  opportunityScore: 88,
  analyzing: false,
  rationale:
    "Relies on a manual grid search over KD temperature and alpha with no Bayesian optimization. Wide unexplored hyperparameter space suggests substantial headroom.",
  summary:
    "Query Encoder Distillation trains a compact query tower by distilling from a larger teacher. The pipeline currently tunes knowledge-distillation alpha and temperature through a hand-run grid, leaving most of the search space unexplored.\n\nTangent can add the most value by replacing the grid with Bayesian search across KD alpha, temperature, learning-rate schedule, and warmup. Early evidence shows the baseline sits well below the achievable frontier on ndcg@10.\n\nPrioritize KD hyperparameter optimization first, then revisit feature pooling once the tuning frontier is mapped.",
  oasisUrl: "https://oasis.example.com/runs/019db6c661691a51840d",
  builtByCurrentUser: true,
  ideas: [
    tangentIdea({
      id: "qed-1",
      rank: 1,
      title: "Bayesian sweep over KD alpha and temperature",
      type: "hyper_parameter_optimization",
      impact: "high",
      evidence:
        "Current tuning is a 3x3 manual grid; neighboring configs show monotonic gains, implying an unexplored optimum.",
      buildState: "built",
      builtBy: CURRENT_USER_NAME,
      builtAt: daysAgo(2),
      unverifiedCount: 2,
      upvotes: 3,
      downvotes: 0,
    }),
    tangentIdea({
      id: "qed-2",
      rank: 2,
      title: "Add cross-shop interaction features",
      type: "feature_engineering",
      impact: "medium",
      evidence:
        "Shops with shared catalogs show correlated relevance; interaction terms are not yet modeled.",
      buildState: "unbuilt",
      upvotes: 1,
      downvotes: 1,
    }),
    humanIdea({
      id: "qed-3",
      rank: 1,
      title: "Try a wider warmup schedule",
      type: "hyper_parameter_optimization",
      evidence:
        "Loss curves plateau early — a longer warmup may stabilize the distillation signal.",
      author: "marco.silva",
      buildState: "built",
      builtBy: "marco.silva",
      builtAt: daysAgo(4),
    }),
  ],
  results: {
    metricDelta: "+3.7% ndcg@10",
    bestDelta: "+3.7%",
    bestRunId: "019db6c661691a51999f",
    configChanges:
      "- kd_alpha: 0.5 -> 0.72\n- kd_temperature: 2.0 -> 3.5\n- warmup_steps: 500 -> 1500",
    topWinningCases: [
      {
        example: "winter boots",
        baseline: "0.61",
        best: "0.74",
        delta: "+0.13",
      },
      {
        example: "linen dress",
        baseline: "0.58",
        best: "0.69",
        delta: "+0.11",
      },
    ],
    topLosingCases: [
      { example: "gift card", baseline: "0.81", best: "0.77", delta: "-0.04" },
    ],
  },
};

const rerankerPipeline: TangentPipeline = {
  runId: "019dc1a2b3c4d5e6f708",
  name: "Catalog Reranker v3",
  ownerEmail: "marco.silva@shopify.com",
  runStatus: "running",
  lastRunAt: daysAgo(0),
  metricName: "mrr",
  metricValue: 0.4123,
  baselineValue: 0.415,
  metricDeltaPct: -0.7,
  scenarioStatus: "tangent_running",
  opportunityScore: 72,
  analyzing: false,
  rationale:
    "Deep architecture with many tunable knobs but stale tuning from six months ago. Recent regression vs baseline indicates drift worth re-optimizing.",
  summary:
    "Catalog Reranker v3 is a cross-encoder reranking model with a large number of tunable layers and heads. Tuning has not been revisited in months and the latest run regressed slightly against baseline.\n\nTangent can drive value by re-optimizing learning rate, layer freezing, and head capacity together, and by exploring negative-mining strategies that the current data pipeline does not use.",
  oasisUrl: "https://oasis.example.com/runs/019dc1a2b3c4d5e6f708",
  builtByCurrentUser: false,
  ideas: [
    tangentIdea({
      id: "rr-1",
      rank: 1,
      title: "Unfreeze top transformer layers",
      type: "model_architecture",
      impact: "high",
      evidence:
        "Only the head is trainable today; unfreezing the top 2 layers is cheap and commonly lifts reranking quality.",
      buildState: "building",
      upvotes: 2,
      downvotes: 0,
    }),
    tangentIdea({
      id: "rr-2",
      rank: 2,
      title: "Hard negative mining from impression logs",
      type: "input_data",
      impact: "medium",
      evidence:
        "Training uses random negatives; impression logs contain harder negatives that better match serving.",
      buildState: "unbuilt",
    }),
  ],
};

const embeddingPipeline: TangentPipeline = {
  runId: "019dc9f8e7d6c5b4a302",
  name: "Product Embedding Tower",
  ownerEmail: "rin.tanaka@shopify.com",
  runStatus: "succeeded",
  lastRunAt: daysAgo(3),
  metricName: "recall@100",
  metricValue: 0.8312,
  baselineValue: 0.8205,
  metricDeltaPct: 1.3,
  scenarioStatus: "scenario_ready",
  opportunityScore: 58,
  analyzing: false,
  rationale:
    "Already uses partial Bayesian tuning, so opportunity is moderate. Embedding pooling choices remain unexplored and could yield incremental gains.",
  summary:
    "Product Embedding Tower learns dense product representations for retrieval. It already uses a partial Bayesian sweep, so the highest-leverage remaining opportunities are around embedding pooling and feature crosses.",
  oasisUrl: "https://oasis.example.com/runs/019dc9f8e7d6c5b4a302",
  builtByCurrentUser: true,
  ideas: [
    tangentIdea({
      id: "emb-1",
      rank: 1,
      title: "Compare mean vs attention pooling",
      type: "feature_engineering",
      impact: "medium",
      evidence:
        "Mean pooling discards positional signal; attention pooling is inexpensive to trial.",
      buildState: "built",
      builtBy: CURRENT_USER_NAME,
      builtAt: daysAgo(5),
      unverifiedCount: 0,
      upvotes: 1,
      downvotes: 0,
    }),
  ],
};

const intentPipeline: TangentPipeline = {
  runId: "019dd0112233445566aa",
  name: "Search Intent Classifier",
  ownerEmail: "amara.okafor@shopify.com",
  runStatus: "failed",
  lastRunAt: daysAgo(2),
  metricName: "f1",
  metricValue: undefined,
  baselineValue: 0.774,
  scenarioStatus: "scenario_built",
  opportunityScore: 49,
  analyzing: false,
  rationale:
    "Moderate opportunity with a mature tuning history. The last run failed, so re-establishing a clean baseline is the first step before optimization.",
  summary:
    "Search Intent Classifier routes queries to downstream rankers. Tuning is relatively mature, so opportunity is moderate. The most recent run failed and should be re-run to restore a reliable baseline.",
  oasisUrl: "https://oasis.example.com/runs/019dd0112233445566aa",
  builtByCurrentUser: false,
  ideas: [
    humanIdea({
      id: "int-1",
      rank: 1,
      title: "Rebalance training labels by intent class",
      type: "input_data",
      evidence:
        "Tail intent classes are under-represented; class weighting may recover F1 on rare intents.",
      author: "amara.okafor",
      buildState: "built",
      builtBy: "amara.okafor",
      builtAt: daysAgo(6),
    }),
  ],
};

const spellPipeline: TangentPipeline = {
  runId: "019dd44556677889900b",
  name: "Spell Correction Seq2Seq",
  ownerEmail: "amara.okafor@shopify.com",
  runStatus: "succeeded",
  lastRunAt: daysAgo(8),
  metricName: "exact_match",
  metricValue: 0.9012,
  baselineValue: 0.901,
  metricDeltaPct: 0.02,
  scenarioStatus: "no_scenario",
  opportunityScore: 31,
  analyzing: false,
  rationale:
    "Low opportunity: the model is near a well-explored optimum with stable, mature tuning and little remaining search space.",
  summary:
    "Spell Correction Seq2Seq is a mature pipeline operating close to its explored optimum. Remaining opportunity is low; gains would likely require new data sources rather than tuning.",
  oasisUrl: "https://oasis.example.com/runs/019dd44556677889900b",
  builtByCurrentUser: false,
  ideas: [],
};

const newPipeline: TangentPipeline = {
  runId: "019dd8899aabbccddee0",
  name: "Multimodal Ranker (experimental)",
  ownerEmail: "rin.tanaka@shopify.com",
  runStatus: "succeeded",
  lastRunAt: daysAgo(0),
  metricName: "ndcg@10",
  metricValue: 0.598,
  baselineValue: undefined,
  scenarioStatus: "no_scenario",
  opportunityScore: null,
  analyzing: true,
  rationale: undefined,
  summary: undefined,
  oasisUrl: "https://oasis.example.com/runs/019dd8899aabbccddee0",
  builtByCurrentUser: false,
  ideas: [],
};

export const MOCK_PIPELINES: TangentPipeline[] = [
  queryEncoderPipeline,
  rerankerPipeline,
  embeddingPipeline,
  intentPipeline,
  spellPipeline,
  newPipeline,
];

export const MOCK_TEAM_STATS: TeamStats = {
  members: 4,
  scenarios: 7,
  withResults: 1,
};
