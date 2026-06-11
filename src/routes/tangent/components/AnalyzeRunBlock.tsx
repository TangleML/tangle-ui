import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";

const RUN_ID_PATTERN = /^019[0-9a-f]{17}$/;

const INVALID_ID_MESSAGE =
  'Run IDs are 20 hex characters starting with "019", e.g. 019db6c661691a51840d';

export function AnalyzeRunBlock() {
  const notify = useToastNotification();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = () => {
    const normalized = value.trim().toLowerCase();
    if (!RUN_ID_PATTERN.test(normalized)) {
      setError(INVALID_ID_MESSAGE);
      return;
    }
    setError(null);
    // Phase 1: the analyze flow is mocked and not yet wired.
    notify(
      "Analyzing arbitrary runs is coming soon — browse the pipelines below for now.",
      "info",
    );
  };

  return (
    <BlockStack
      gap="3"
      className="rounded-xl border border-border bg-background p-6"
    >
      <BlockStack gap="1">
        <Heading level={2}>Add your run here</Heading>
        <Paragraph size="sm" tone="subdued">
          Get an instant optimization score and scenario recommendations for any
          Tangle run
        </Paragraph>
      </BlockStack>
      <InlineStack gap="2" blockAlign="start" wrap="nowrap">
        <BlockStack gap="1" className="flex-1">
          <Input
            value={value}
            placeholder="Paste a Tangle run ID to analyze…"
            aria-invalid={error !== null}
            aria-label="Tangle run ID"
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            onEnter={handleAnalyze}
          />
          {error && (
            <Text size="xs" tone="critical">
              {error}
            </Text>
          )}
        </BlockStack>
        <Button onClick={handleAnalyze}>Analyze</Button>
      </InlineStack>
    </BlockStack>
  );
}
