import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";

import { TANGENT_AI_REQUIRED } from "./aiSetupCopy";

interface AiGate {
  isConfigured: boolean;
  disabled: boolean;
  title: string | undefined;
}

/**
 * What a button that needs an AI provider does without one: it stays put,
 * disabled, and says why on hover. Three of them say it, and a button that
 * explained itself differently would read as a different obstacle.
 *
 * `enabledTitle` is the tooltip once a provider is there, for a button whose
 * own label is too short to stand alone.
 */
export function useAiGate(enabledTitle?: string): AiGate {
  const { isConfigured } = useAiProviderSettings();

  return {
    isConfigured,
    disabled: !isConfigured,
    title: isConfigured ? enabledTitle : TANGENT_AI_REQUIRED,
  };
}
