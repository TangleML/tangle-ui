import { useDeferredValue, useState, useTransition } from "react";

import ImportComponent from "@/components/shared/ReactFlow/FlowSidebar/components/ImportComponent";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useDebouncedSearchValue } from "@/hooks/useDebouncedSearchValue";
import { useComponentSearchV2State } from "@/routes/v2/pages/Editor/hooks/useComponentSearchV2State";

import { ComponentSearchResults } from "./ComponentSearchResults";

const EDITOR_SEARCH_RESULT_DEBOUNCE_MS = 500;

function DebouncedComponentSearchInput({
  initialValue,
  onCommit,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useDebouncedSearchValue(
    onCommit,
    EDITOR_SEARCH_RESULT_DEBOUNCE_MS,
    initialValue,
  );

  return (
    <Input
      type="text"
      data-testid="search-input"
      placeholder="Search components..."
      className="w-full pl-8 text-sm h-8 focus-visible:ring-gray-400/50"
      value={localValue}
      onChange={(event) => setLocalValue(event.target.value)}
      aria-label="Search components"
      autoComplete="off"
    />
  );
}

export function ComponentSearchV2Content() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [, startSearchTransition] = useTransition();
  const {
    results,
    browseFolders,
    isLoading,
    canRerank,
    isReranking,
    isRerankActive,
    rerank,
    clearRerank,
  } = useComponentSearchV2State(deferredQuery);

  const handleQueryCommit = (value: string) => {
    startSearchTransition(() => setQuery(value));
  };

  const handleSuggestedSearch = (value: string) => {
    startSearchTransition(() => setQuery(value));
  };

  return (
    <BlockStack className="h-full min-h-0 overflow-hidden [&_.text-sm]:text-xs!">
      <BlockStack gap="2" className="px-2 py-2">
        <ImportComponent
          triggerComponent={
            <InlineStack
              gap="1"
              blockAlign="center"
              align="center"
              className="w-full py-1.5 cursor-pointer text-gray-500 hover:text-gray-900 transition-colors border border-dashed border-gray-300 rounded-lg hover:border-gray-400"
              data-testid="import-component-button"
            >
              <Icon name="PackagePlus" size="sm" />
              <Text size="sm">Add Component</Text>
            </InlineStack>
          }
        />
        <InlineStack
          gap="2"
          blockAlign="center"
          wrap="nowrap"
          className="w-full"
        >
          <div className="relative flex-1 min-w-0">
            <InlineStack
              blockAlign="center"
              className="absolute inset-y-0 left-0 pl-2.5 z-10 pointer-events-none"
            >
              <Icon name="Search" size="sm" className="text-gray-400" />
            </InlineStack>
            <DebouncedComponentSearchInput
              initialValue={query}
              onCommit={handleQueryCommit}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 p-0 shrink-0"
            aria-label={isReranking ? "AI reranking in progress" : "AI rerank"}
            title="AI rerank — rerank a bounded set of top candidates"
            onClick={rerank}
            disabled={!canRerank || isReranking}
          >
            {isReranking ? <Spinner size={14} /> : <Icon name="Sparkles" />}
          </Button>
        </InlineStack>
      </BlockStack>
      <ComponentSearchResults
        query={deferredQuery}
        results={results}
        browseFolders={browseFolders}
        isLoading={isLoading}
        isRerankActive={isRerankActive}
        onClearRerank={clearRerank}
        onSuggestedSearch={handleSuggestedSearch}
      />
    </BlockStack>
  );
}
