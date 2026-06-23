import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSearchSuggestion } from "@/services/componentSearchSuggestions";
import { tracking } from "@/utils/tracking";

interface ComponentSearchEmptyStateSuggestionsProps {
  onSelectSuggestion: (query: string) => void;
  suggestions: ComponentSearchSuggestion[];
  surface: string;
}

export function ComponentSearchEmptyStateSuggestions({
  onSelectSuggestion,
  suggestions,
  surface,
}: ComponentSearchEmptyStateSuggestionsProps) {
  return (
    <InlineStack gap="2">
      <Text size="xs" tone="subdued">
        Suggested searches:
      </Text>
      {suggestions.map((suggestion, index) => (
        <Button
          key={suggestion.label}
          type="button"
          variant="outline"
          size="xs"
          onClick={() => onSelectSuggestion(suggestion.label)}
          {...tracking("component_library.search.suggestion", {
            surface,
            suggestion_kind: suggestion.kind,
            suggestion_position: index,
          })}
        >
          {suggestion.label}
        </Button>
      ))}
    </InlineStack>
  );
}
