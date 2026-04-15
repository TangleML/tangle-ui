import { type KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";

interface ChatInputProps {
  isPending: boolean;
  onSubmit: (prompt: string) => void;
}

export function ChatInput({ isPending, onSubmit }: ChatInputProps) {
  const [prompt, setPrompt] = useState("");

  function handleSubmit() {
    const trimmed = prompt.trim();
    if (!trimmed || isPending) return;
    setPrompt("");
    onSubmit(trimmed);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <InlineStack gap="2" className="border-t p-2 w-full" blockAlign="center">
      <textarea
        className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        rows={2}
        placeholder="Ask about your pipeline..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isPending}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleSubmit}
        disabled={isPending || !prompt.trim()}
        aria-label="Send message"
      >
        <Icon name={isPending ? "Loader" : "Send"} />
      </Button>
    </InlineStack>
  );
}
