import { AiModelPicker } from "@/components/shared/Settings/AiModelPicker";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";

export function AiModelQuickSelect() {
  const { isConfigured } = useAiProviderSettings();

  if (!isConfigured) {
    return null;
  }

  return <AiModelPicker variant="header" />;
}
