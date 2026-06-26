import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { COMPONENT_SEARCH_EMPTY_STATE_SUGGESTIONS } from "@/services/componentSearchSuggestions";
import { tracking } from "@/utils/tracking";

interface ComponentSearchEmptyStateSuggestionsProps {
  onSelectSuggestion: (query: string) => void;
  surface: string;
}

export function ComponentSearchEmptyStateSuggestions({
  onSelectSuggestion,
  surface,
}: ComponentSearchEmptyStateSuggestionsProps) {
  return (
    <InlineStack gap="2">
      <Text size="xs" tone="subdued">
        Suggested searches:
      </Text>
      {COMPONENT_SEARCH_EMPTY_STATE_SUGGESTIONS.map((suggestion) => (
        <Button
          key={suggestion}
          type="button"
          variant="outline"
          size="xs"
          onClick={() => onSelectSuggestion(suggestion)}
          {...tracking("component_library.search.suggestion", {
            surface,
            suggested_query: suggestion,
          })}
        >
          {suggestion}
        </Button>
      ))}
    </InlineStack>
  );
}
