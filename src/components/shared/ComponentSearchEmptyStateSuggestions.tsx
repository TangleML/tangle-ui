import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { COMPONENT_SEARCH_EMPTY_STATE_SUGGESTIONS } from "@/services/componentSearchSuggestions";

interface ComponentSearchEmptyStateSuggestionsProps {
  onSelectSuggestion: (query: string) => void;
}

export function ComponentSearchEmptyStateSuggestions({
  onSelectSuggestion,
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
        >
          {suggestion}
        </Button>
      ))}
    </InlineStack>
  );
}
