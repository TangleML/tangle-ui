export function buildDebugInstructions(runId: string): string {
  return [
    `Your goal is to diagnose and fix the failed pipeline run ${runId}.`,
    "The failed run is attached to this project as a resource.",
  ].join("\n");
}

export function buildDebugStartingPrompt(runId: string): string {
  return [
    `The pipeline run ${runId} has failed and is attached to this project.`,
    "Please help me debug and fix it by following these steps:",
    "",
    "1. Open the failed run in the workarea and inspect what happened.",
    "2. Work out what went wrong and summarize your findings for me.",
    "3. Clone the failed run's pipeline and open the clone in a new workarea tab. Cloning attaches it to this project automatically.",
    "4. Fix the cloned pipeline by spawning an editor sub-agent and editing it with the CSOM tools.",
    "5. Run auto-layout on the fixed pipeline so the layout stays clean.",
  ].join("\n");
}
