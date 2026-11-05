import {
  PROJECT_MOUNT_NAME,
  PROJECT_NOTES_ROOT,
} from "@/routes/v2/pages/Tangent/services/projectSharedMemory";
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
    `- This project's id is ${projectId}, and membership is the annotation`,
    `  \`${projectRunAnnotationKey(projectId)}: "true"\` — the id is in the key`,
    '  and the value is always the string "true".',
    "- `tangle-deploy pipeline-run submit` and `submit-from-python` already carry",
    "  this annotation: the session sets TANGLE_ROOT_CONFIG so every submit is",
    "  attributed for you. Do not pass `-a`/`--annotations` to those commands — it",
    "  replaces the whole annotations field and drops the project key. To add your",
    "  own annotations there, use `--config`, whose `annotations` block deep-merges",
    "  over the project key instead of replacing it.",
    "- A run you submit any other way must carry the annotation yourself. Pass it",
    "  in `annotations` to POST /api/pipeline_runs/, or in `pipeline_run_annotations`",
    "  to POST /api/pipeline_runs/from_pipeline/{id}. A run without it never reaches",
    "  the project, and the key cannot be added afterwards.",
    "- Name one project per run. A submission naming two is rejected.",
    "- Never put this key on a pipeline you save. The pipeline write path answers",
    "  422, because stored pipeline annotations decide a pipeline's version",
    "  identity and the same pipeline run from two projects is one pipeline.",
    "- A run you start through the pipeline canvas is attributed for you.",
  ].join("\n");

const SHARED_FOLDER_BRIEF = [
  "Sharing work across this project's sessions:",
  `- \`${PROJECT_MOUNT_NAME}/\` is the project's shared folder. Every session in`,
  "  this project mounts the same folder, and writes show up in the others",
  "  immediately. Put work later sessions should build on there, not in",
  "  `uploads/`, which is private to this session.",
  "- Your memory_* tools write a store inside that folder, so other sessions in",
  "  this project read what you remember. Record decisions, conventions and",
  "  hard-won findings with memory_write, and memory_search before re-deriving",
  "  something an earlier session may already have settled.",
  `- \`${PROJECT_NOTES_ROOT}/MEMORY.md\` is the project's human-readable note.`,
  "  Keep it short and current; people read it too.",
  "- Never write secrets, tokens or credentials into the shared folder.",
].join("\n");

interface SessionMemorySeedOptions {
  hasSharedFolder?: boolean;
}

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
  { hasSharedFolder = false }: SessionMemorySeedOptions = {},
): string {
  const instructions = projectInstructions?.trim();
  const briefs = [
    NAMING_BRIEF,
    runAttributionBrief(projectId),
    ...(hasSharedFolder ? [SHARED_FOLDER_BRIEF] : []),
  ].join("\n\n");
  return instructions ? `${instructions}\n\n${briefs}` : briefs;
}
