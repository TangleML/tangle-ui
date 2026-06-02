import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";

import { MessageBubble } from "./MessageBubble";

interface ThinkingMessageProps {
  text: string;
}

export function ThinkingMessage({ text }: ThinkingMessageProps) {
  return (
    <MessageBubble variant="assistant" tone="muted" direction="inline" gap="2">
      <Icon
        name="Loader"
        size="sm"
        className="animate-spin text-muted-foreground"
      />
      <Text size="sm" tone="subdued" className="italic">
        {text}
      </Text>
    </MessageBubble>
  );
}
