import { useRunTangentHandoff } from "./useRunTangentHandoff";

export function useOpenInTangent() {
  return useRunTangentHandoff({
    newProjectName: ({ pipelineName }) => pipelineName,
    provisionalNewProjectName: true,
    startsEmptySession: true,
  });
}
