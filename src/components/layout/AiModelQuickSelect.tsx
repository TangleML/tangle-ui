import { AiModelPicker } from "@/components/shared/Settings/AiModelPicker";
import {
  useFlagValue,
  useTangentEnabled,
} from "@/components/shared/Settings/useFlags";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";

export function AiModelQuickSelect() {
  const componentSearchEnabled = useFlagValue("component-search-v2");
  const aiAssistantEnabled = useFlagValue("ai-assistant");
  const tangentEnabled = useTangentEnabled();
  const { isConfigured } = useAiProviderSettings();
  const usesTheModel =
    componentSearchEnabled || aiAssistantEnabled || tangentEnabled;

  if (!usesTheModel || !isConfigured) {
    return null;
  }

  return <AiModelPicker variant="header" />;
}
