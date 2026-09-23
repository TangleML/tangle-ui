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

/**
 * The session's standing memory, seeded before the agent spawns so it is
 * context from the first turn rather than something said in the transcript.
 *
 * One entry, not two: a memory seed writes the session's memory store, so a
 * second would be a second write of the same document. The project's own
 * instructions come first, because they are what the human wrote.
 */
export function sessionMemorySeed(projectInstructions?: string | null): string {
  const instructions = projectInstructions?.trim();
  return instructions ? `${instructions}\n\n${NAMING_BRIEF}` : NAMING_BRIEF;
}
