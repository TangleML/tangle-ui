/**
 * This file is a PoC for the autoresearch prompt.
 */
import yaml from "js-yaml";

import type {
  ScenarioEntry,
  ScenarioIdea,
} from "@/routes/tangent/idb/tangentDb";

const UNVERIFIED = "UNVERIFIED - resolve from baseline run before submitting";

/** Subset of the legacy prompt-builder `p` object, derived from a scenario. */
interface AutoresearchParams {
  id: string;
  runId: string;
  ideas: ScenarioIdea[];
  metric?: string;
  metricBaseline?: string;
}

/**
 * Synthesize a minimal `scenario.yaml` from the saved scenario plan. Populated
 * plan fields are passed through; unknown fields are emitted as explicit
 * UNVERIFIED placeholders so the agent's pre-flight checks resolve them.
 */
function buildScenarioYaml(scenario: ScenarioEntry): string {
  const { plan } = scenario;

  const yamlObject: Record<string, unknown> = {
    name: plan.name,
    description: plan.description,
    pipeline: plan.pipeline ?? {
      path: UNVERIFIED,
      baseline_run_id: scenario.run.runId,
    },
    metrics: plan.metrics ?? { target: { path: UNVERIFIED } },
    search_space: plan.search_space ?? {},
  };

  if (plan.experiment_actions) {
    yamlObject.experiment_actions = plan.experiment_actions;
  }
  if (plan.research) yamlObject.research = plan.research;
  if (plan.budget) yamlObject.budget = plan.budget;
  if (plan.timing) yamlObject.timing = plan.timing;
  if (plan.failure_playbook)
    yamlObject.failure_playbook = plan.failure_playbook;

  return yaml.dump(yamlObject, { sortKeys: false });
}

/** Initial MEMORY.md scaffolding for a scenario that has not run yet. */
function initialMemoryMd(p: AutoresearchParams): string {
  const metricLine = p.metric
    ? `Baseline ${p.metric}: ${p.metricBaseline ?? "unknown"}`
    : "Baseline metric: unknown";
  const ideasSection =
    p.ideas.length > 0
      ? p.ideas
          .slice(0, 3)
          .map((idea, i) => `${i + 1}. ${idea.title} [${idea.impact}]`)
          .join("\n")
      : "No ideas yet — researcher will generate in Step 1.";

  return `# MEMORY.md

## Best Config
No experiments run yet — round 1 has not completed.
${metricLine}

## Key Lessons
- Starting fresh. Researcher will analyze baseline metrics in Step 1.

## Top Hypotheses to Test
${ideasSection}

## Active Runs
(none yet — will be filled after round 1 submission)

## Experiment Log
(none)
`;
}

interface BuildPromptOptions {
  rounds?: number;
  autoApprove?: boolean;
}

/**
 * Build the autoresearch prompt for a scenario, ported from the legacy
 * `generateRiverMessage`. The agent is asked to run `tangent auto` for one round
 * and sync state to GCS.
 */
export function buildAutoresearchPrompt(
  scenario: ScenarioEntry,
  { rounds = 3, autoApprove = true }: BuildPromptOptions = {},
): string {
  const p: AutoresearchParams = {
    id: scenario.id,
    runId: scenario.run.runId,
    ideas: scenario.ideas,
  };

  // todo: remove hardcoded GCS path
  const gcsPath = `gs://shopify-discovery-relevance/tangent/scenarios/${p.id}/`;
  const approveNote = autoApprove
    ? "Auto-approve the first hypothesis — use the top researcher suggestion without waiting for human input."
    : "Pause for hypothesis approval before submitting runs.";
  const memory = initialMemoryMd(p).trim();

  // Ensure the scenario.yaml name matches the pipeline ID to avoid ambiguity.
  const yamlFixed = buildScenarioYaml(scenario)
    .trim()
    .replace(/^(name:\s*)(.+)/m, `$1${p.id}`);

  const currentLocation = window.location.href;

  return `Please run \`tangent auto\` for the following scenario — **1 round in this session** (${rounds} total planned across sessions).
This is a multi-session workflow: run round 1, sync state to GCS, then hand off cleanly. The next session resumes from "Active Runs" in MEMORY.md.
${approveNote}

**Current URL:** \`${currentLocation}\`
**Baseline run ID:** \`${p.runId}\`
**Scenario ID (canonical):** \`${p.id}\`
**GCS output path:** \`${gcsPath}\`
Fork the pipeline from the baseline run — do not touch the mainline. After round 1 completes, write MEMORY.md, sessions/, and logs/ to the GCS path above.

**Pre-flight checks (resolve before submitting any runs):**
- [ ] All \`search_space[*].current\` values match the actual baseline run config (not guessed)
- [ ] All \`search_space[*].range\` brackets extend at or above the baseline value for quality-lift experiments
- [ ] All categorical \`choices\` are confirmed against source code validation (no guessed enum values)
- [ ] \`metrics.target.path\` key exists in a downloaded baseline metrics artifact
- [ ] Any UNVERIFIED fields in the YAML are resolved or explicitly noted in MEMORY.md before runs are submitted

**Auto-approvals — no need to confirm these with me:**
- Fix \`score_transform\` (or any categorical) choices to match what the pipeline code actually accepts.
- If baseline HPs fall outside declared search space ranges, widen the ranges to include the baseline.
- Resolve all metric paths from the latest baseline run artifact — override any placeholder names in the YAML.
- If the primary metric is monotonically dominated by a boundary value, apply option B: add a hard floor at 10% above the lower bound and continue.
- Submit sentinel immediately without waiting for confirmation.
- Stage round 1 immediately after sentinel submission — do not wait for it to complete before planning.
- Hold and ask only if: pipeline export fails, auth is broken, sentinel metric deviates >5% from stated baseline, or a guard metric key is missing from the artifact entirely.

---
**scenario.yaml:**
\`\`\`yaml
${yamlFixed}
\`\`\`

---
**MEMORY.md:**
\`\`\`
${memory}
\`\`\``;
}
