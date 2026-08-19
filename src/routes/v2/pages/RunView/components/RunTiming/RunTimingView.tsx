import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";

export function RunTimingView() {
  return (
    <BlockStack
      fill
      gap="3"
      className="bg-background p-6 text-center"
      data-testid="run-timing-view"
    >
      <Icon
        name="ChartNoAxesGantt"
        size="xl"
        className="text-muted-foreground"
      />
      <Heading level={1}>Run timing</Heading>
      <Paragraph tone="subdued">
        Task timing and run performance will appear here.
      </Paragraph>
    </BlockStack>
  );
}
