import { AiModelPicker } from "@/components/shared/Settings/AiModelPicker";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";

export function AiModelQuickSelect() {
  const componentSearchEnabled = useFlagValue("component-search-v2");
  const aiAssistantEnabled = useFlagValue("ai-assistant");
  const { isConfigured } = useAiProviderSettings();

  if ((!componentSearchEnabled && !aiAssistantEnabled) || !isConfigured) {
    return null;
  }

  return <AiModelPicker variant="header" />;
}
