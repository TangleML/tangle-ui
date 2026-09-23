import { AiModelSelect } from "@/components/shared/AiModelSelect/AiModelSelect";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";

export function AiModelQuickSelect() {
  const componentSearchEnabled = useFlagValue("component-search-v2");
  const aiAssistantEnabled = useFlagValue("ai-assistant");
  const {
    config,
    updateManualConfig,
    setBackendModel,
    isConfigured,
    isManuallyConfigured,
  } = useAiProviderSettings();
  const handleValueChange = (value: string) => {
    if (isManuallyConfigured) {
      updateManualConfig({ model: value });
    } else {
      setBackendModel(value);
    }
  };

  if ((!componentSearchEnabled && !aiAssistantEnabled) || !isConfigured) {
    return null;
  }

  return (
    <AiModelSelect
      value={config.model}
      onValueChange={handleValueChange}
      allowProviderDefault={isManuallyConfigured}
      appearance="header"
    />
  );
}
