import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface ThinkingMessageProps {
  text: string;
}

export function ThinkingMessage({ text }: ThinkingMessageProps) {
  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      className="self-start rounded-lg bg-muted/60 px-3 py-2 max-w-[85%]"
    >
      <Icon
        name="Loader"
        className="size-3.5 animate-spin text-muted-foreground"
      />
      <Text size="sm" tone="subdued" className="italic">
        {text}
      </Text>
    </InlineStack>
  );
}
