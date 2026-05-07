import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export function InfoOnlyResolution({ message }: { message: string }) {
  return (
    <InlineStack
      gap="2"
      blockAlign="start"
      className="rounded-md bg-slate-50 p-3"
    >
      <Icon name="Info" size="sm" className="text-slate-500 shrink-0 mt-0.5" />
      <Text size="xs" tone="subdued">
        {message}
      </Text>
    </InlineStack>
  );
}
