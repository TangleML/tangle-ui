import { AiModelPicker } from "@/components/shared/Settings/AiModelPicker";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";

export function AiModelQuickSelect() {
  const { isConfigured } = useAiProviderSettings();
  return isConfigured ? <AiModelPicker variant="header" /> : null;
}
