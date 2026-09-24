import { projectRunAnnotationKey } from "@/utils/projectRunAnnotation";

const NAMING_BRIEF = [
  "Naming this work:",
  "- Call name_session during your first turn, as soon as you have read the",
  "  first message. A title of a few words is enough, and the first message is",
  "  enough to write one — do not wait until the work is done.",
  "- If rename_project reports the project's name is still provisional, give it",
  "  a title too. It refuses when someone has named the project deliberately;",
  "  do not argue with it or try again.",
  "- Call name_pipeline in that same first turn. A project opened from a prompt",
  "  already has a pipeline on the canvas named after the request; the opening",
  "  message is enough to title it, so do not wait for the build to finish. It",
  "  refuses when someone named the pipeline deliberately.",
  "- Name a pipeline you create yourself: pass `name` to create_pipeline rather",
  "  than letting it default.",
  "- Titles describe the work, not the request: 'Churn model training', not",
  "  'User wants a churn model'. Do not announce that you have named anything.",
].join("\n");

const runAttributionBrief = (projectId: string) =>
  [
    "Attributing runs to this project:",
    `- This project's id is ${projectId}.`,
    "- A run you submit yourself must carry the annotation",
    `  \`${projectRunAnnotationKey(projectId)}: "true"\` — the id is in the key`,
    '  and the value is always the string "true". Pass it in `annotations` to',
    "  POST /api/pipeline_runs/, or in `pipeline_run_annotations` to",
    "  POST /api/pipeline_runs/from_pipeline/{id}.",
    "- Do this on every submission. A run without the annotation never reaches",
    "  the project, and the key cannot be added afterwards.",
    "- Name one project per run. A submission naming two is rejected.",
    "- Never put this key on a pipeline you save. The pipeline write path answers",
    "  422, because stored pipeline annotations decide a pipeline's version",
    "  identity and the same pipeline run from two projects is one pipeline.",
    "- A run you start through the pipeline canvas is attributed for you, so the",
    "  above is about runs you submit any other way.",
  ].join("\n");

/**
 * The session's standing memory, seeded before the agent spawns so it is
 * context from the first turn rather than something said in the transcript.
 *
 * One entry, not two: a memory seed writes the session's memory store, so a
 * second would be a second write of the same document. The project's own
 * instructions come first, because they are what the human wrote.
 *
 * The project id is in here because nothing else tells an agent what it is: the
 * remote-env handshake carries only the session, and the workarea tools submit
 * no runs. An agent that submits from its own sandbox has to be told the id, or
 * the run it starts is attributed to nothing.
 */
export function sessionMemorySeed(
  projectId: string,
  projectInstructions?: string | null,
): string {
  const instructions = projectInstructions?.trim();
  const briefs = `${NAMING_BRIEF}\n\n${runAttributionBrief(projectId)}`;
  return instructions ? `${instructions}\n\n${briefs}` : briefs;
}
