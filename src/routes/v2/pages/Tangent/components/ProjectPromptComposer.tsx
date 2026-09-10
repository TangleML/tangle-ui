import { type KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";

interface ProjectPromptComposerProps {
  onSubmit: (prompt: string) => void;
  isSubmitting: boolean;
}

export function ProjectPromptComposer({
  onSubmit,
  isSubmitting,
}: ProjectPromptComposerProps) {
  const [prompt, setPrompt] = useState("");

  function submit() {
    const trimmed = prompt.trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <BlockStack
      gap="2"
      className="w-full max-w-2xl rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <Textarea
        className="w-full resize-none border-0 shadow-none focus-visible:ring-0"
        rows={3}
        placeholder="Ask Tangent to build, optimize or debug a Tangle pipeline..."
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSubmitting}
      />
      <InlineStack align="end" blockAlign="center">
        <Button onClick={submit} disabled={isSubmitting || !prompt.trim()}>
          <Icon name={isSubmitting ? "Loader" : "Send"} size="sm" />
          {isSubmitting ? "Starting…" : "Start"}
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
