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
import { getAiModelLabel, getAiModelOptions } from "@/config/aiModels";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";

const PROVIDER_DEFAULT_VALUE = "__provider_default__";

export function AiModelQuickSelect() {
  const componentSearchEnabled = useFlagValue("component-search-v2");
  const aiAssistantEnabled = useFlagValue("ai-assistant");
  const { config, update, isConfigured } = useAiProviderSettings();
  const configuredModel = config.model.trim();
  const options = getAiModelOptions();
  const selectedValue = configuredModel || PROVIDER_DEFAULT_VALUE;
  const hasCustomModel =
    configuredModel && options.every((option) => option.id !== configuredModel);

  const handleValueChange = (value: string) => {
    update({ model: value === PROVIDER_DEFAULT_VALUE ? "" : value });
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
          <SelectItem value={PROVIDER_DEFAULT_VALUE}>
            Provider default
          </SelectItem>
          {hasCustomModel && (
            <SelectItem value={selectedValue}>{selectedValue}</SelectItem>
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
