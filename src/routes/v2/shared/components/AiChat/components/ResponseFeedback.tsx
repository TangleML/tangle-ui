import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/providers/AnalyticsProvider";

interface ResponseFeedbackProps {
  prompt: string;
  response: string;
}

type FeedbackState = "idle" | "submitted";

export function ResponseFeedback({ prompt, response }: ResponseFeedbackProps) {
  const { track } = useAnalytics();
  const [state, setState] = useState<FeedbackState>("idle");

  function handleFeedback(rating: "positive" | "negative") {
    if (state !== "idle") return;
    setState("submitted");
    track("ai_assistant.response.feedback", { rating, prompt, response });
  }

  return (
    <BlockStack className="relative h-5 mt-1.5">
      <InlineStack
        gap="0"
        className={cn(
          "transition-opacity duration-200",
          state === "submitted" ? "opacity-0" : "opacity-100",
        )}
        aria-hidden={state === "submitted"}
      >
        <Button
          type="button"
          variant="ghost"
          size="min"
          onClick={() => handleFeedback("positive")}
          disabled={state !== "idle"}
          aria-label="Helpful response"
          className="text-muted-foreground/30 hover:text-info transition-colors duration-150"
        >
          <Icon name="ThumbsUp" size="xs" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="min"
          onClick={() => handleFeedback("negative")}
          disabled={state !== "idle"}
          aria-label="Not helpful response"
          className="text-muted-foreground/30 hover:text-info transition-colors duration-150"
        >
          <Icon name="ThumbsDown" size="xs" />
        </Button>
      </InlineStack>
      <Text
        size="xs"
        tone="subdued"
        className={cn(
          "absolute left-0 top-0 transition-opacity duration-300 delay-200",
          state === "submitted"
            ? "opacity-100"
            : "opacity-0 pointer-events-none",
        )}
      >
        Thank you for sharing your feedback
      </Text>
    </BlockStack>
  );
}
