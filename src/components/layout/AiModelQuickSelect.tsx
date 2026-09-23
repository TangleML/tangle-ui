import { AiModelSelect } from "@/components/shared/AiModelSelect/AiModelSelect";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import type { AiModelSelection } from "@/config/aiModels";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";

export function AiModelQuickSelect() {
  const componentSearchEnabled = useFlagValue("component-search-v2");
  const aiAssistantEnabled = useFlagValue("ai-assistant");
  const {
    config,
    updateManualConfig,
    setBackendModel,
    setBackendReasoningEffort,
    isConfigured,
    isManuallyConfigured,
  } = useAiProviderSettings();
  const handleSelectionChange = (selection: AiModelSelection) => {
    if (isManuallyConfigured) {
      updateManualConfig(selection);
    } else {
      setBackendModel(selection.model);
      setBackendReasoningEffort(selection.reasoningEffort);
    }
  };

  if ((!componentSearchEnabled && !aiAssistantEnabled) || !isConfigured) {
    return null;
  }

  return (
    <AiModelSelect
      model={config.model}
      reasoningEffort={config.reasoningEffort}
      onChange={handleSelectionChange}
      appearance="header"
    />
  );
}
