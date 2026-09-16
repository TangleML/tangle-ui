import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { registerWorkareaKind } from "./registry";
import type { WorkareaTab } from "./types";

function PipelineWorkareaView({
  tab,
}: {
  tab: Extract<WorkareaTab, { kind: "pipeline" }>;
}) {
  const targetId = tab.pipelineRef.fileId ?? tab.pipelineRef.name;
  return (
    <BlockStack
      gap="2"
      align="center"
      className="min-h-0 flex-1 justify-center p-6 text-center"
    >
      <Icon name="Workflow" size="lg" className="text-muted-foreground" />
      <Text size="sm" weight="semibold">
        {tab.title}
      </Text>
      <Text size="xs" tone="subdued">
        Pipeline {targetId}
      </Text>
      <Text size="xs" tone="subdued">
        The embedded pipeline editor arrives in a later change.
      </Text>
    </BlockStack>
  );
}

registerWorkareaKind({
  kind: "pipeline",
  icon: "Workflow",
  keepMounted: false,
  render: (tab) => {
    if (tab.kind !== "pipeline") return null;
    return <PipelineWorkareaView tab={tab} />;
  },
});
