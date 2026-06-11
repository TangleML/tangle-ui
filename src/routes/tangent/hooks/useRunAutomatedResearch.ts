import { useMutation } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import type { ScenarioEntry } from "@/routes/tangent/idb/tangentDb";
import {
  createOpencodeSession,
  resolveInstanceId,
  sendAutoresearchMessage,
} from "@/routes/tangent/services/autoresearchOpencode";
import { buildAutoresearchPrompt } from "@/routes/tangent/services/autoresearchPrompt";

/**
 * Sends a scenario's autoresearch prompt to a Tangent OpenCode agent: resolves
 * (or creates) an instance, opens a fresh session, and fires the prompt.
 */
export function useRunAutomatedResearch() {
  const notify = useToastNotification();

  return useMutation({
    mutationFn: async (scenario: ScenarioEntry) => {
      const instanceId = await resolveInstanceId();
      const sessionId = await createOpencodeSession(
        instanceId,
        `Autoresearch: ${scenario.plan.name}`,
      );
      const prompt = buildAutoresearchPrompt(scenario);
      await sendAutoresearchMessage(instanceId, sessionId, prompt);
    },
    onSuccess: () => {
      notify("Automated research started", "success");
    },
    onError: (error) => {
      notify(`Failed to start automated research: ${error}`, "error");
    },
  });
}
