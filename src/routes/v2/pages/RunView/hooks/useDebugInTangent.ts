import { instructionsResourceInput } from "@/services/projects/resourceDescriptor";

import {
  buildDebugInstructions,
  buildDebugStartingPrompt,
} from "./debugInTangentPrompts";
import { useRunTangentHandoff } from "./useRunTangentHandoff";

export function useDebugInTangent() {
  return useRunTangentHandoff({
    newProjectName: ({ pipelineName }) => `Debug: ${pipelineName}`,
    // The project's instructions are someone else's, and there is only ever one
    // document holding them, so an existing project gets the brief through the
    // opening prompt instead.
    newProjectDocuments: (project, { runId }) => [
      instructionsResourceInput(buildDebugInstructions(runId, project.id)),
    ],
    startingSession: ({ runId }) => ({
      prompt: buildDebugStartingPrompt(runId),
    }),
  });
}
