import { useFlagValue } from "@/components/shared/Settings/useFlags";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAiModelLabel,
  getAiModelOptions,
  getDefaultAiModelId,
} from "@/config/aiModels";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";

const PROVIDER_DEFAULT_MODEL_VALUE = "__provider_default__";

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
  const configuredModel = config.model.trim();
  const options = getAiModelOptions();
  const selectedValue =
    configuredModel ||
    (isManuallyConfigured
      ? PROVIDER_DEFAULT_MODEL_VALUE
      : getDefaultAiModelId());
  const hasCustomModel =
    selectedValue !== PROVIDER_DEFAULT_MODEL_VALUE &&
    options.every((option) => option.id !== selectedValue);

  const handleValueChange = (value: string) => {
    if (isManuallyConfigured) {
      updateManualConfig({
        model: value === PROVIDER_DEFAULT_MODEL_VALUE ? "" : value,
      });
    } else {
      setBackendModel(value);
    }
  };

  if ((!componentSearchEnabled && !aiAssistantEnabled) || !isConfigured) {
    return null;
  }

  return (
    <Select value={selectedValue} onValueChange={handleValueChange}>
      <SelectTrigger
        aria-label="AI model"
        title={`AI model: ${getAiModelLabel(configuredModel)}`}
        className="hidden h-8 max-w-48 border-0 bg-transparent px-1 text-xs text-white shadow-none hover:bg-stone-800/70 focus-visible:ring-white/30 lg:flex [&_svg]:text-stone-300"
      >
        <SelectValue placeholder="AI model" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          <SelectLabel>AI model</SelectLabel>
          {isManuallyConfigured && (
            <SelectItem value={PROVIDER_DEFAULT_MODEL_VALUE}>
              Provider default
            </SelectItem>
          )}
          {hasCustomModel && (
            <SelectItem value={selectedValue}>
              {getAiModelLabel(selectedValue)}
            </SelectItem>
          )}
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label ?? option.id}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
