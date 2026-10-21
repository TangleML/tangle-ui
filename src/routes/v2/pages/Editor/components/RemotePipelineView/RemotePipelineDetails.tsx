import { dump } from "js-yaml";
import { observer } from "mobx-react-lite";

import { CodeViewer } from "@/components/shared/CodeViewer";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import { serializeComponentSpec } from "@/models/componentSpec";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { isGraphImplementation } from "@/utils/componentSpec";

export const RemotePipelineDetails = observer(function RemotePipelineDetails({
  ownerId,
}: {
  ownerId?: string;
}) {
  const { navigation, editor } = useSharedStores();
  const spec = navigation.activeSpec;
  if (!spec) return null;
  const serialized = serializeComponentSpec(spec);
  const type = editor.selectedNodeType;
  const entity = (
    type === "task"
      ? spec.tasks
      : type === "input"
        ? spec.inputs
        : type === "output"
          ? spec.outputs
          : []
  ).find((node) => node.$id === editor.selectedNodeId);
  const selected =
    entity &&
    (type === "task"
      ? isGraphImplementation(serialized.implementation)
        ? serialized.implementation.graph.tasks[entity.name]
        : undefined
      : (type === "input" ? serialized.inputs : serialized.outputs)?.find(
          (io) => io.name === entity.name,
        ));
  const title = entity
    ? `${entity.name} — ${type} details`
    : navigation.navigationDepth > 0
      ? "Subgraph details"
      : "Pipeline details";

  return (
    <aside
      aria-label="Pipeline details"
      className="w-96 max-w-[50%] min-w-0 shrink-0 border-l bg-card flex flex-col select-text"
    >
      <BlockStack gap="2" className="p-4 shrink-0">
        <Heading level={3}>{title}</Heading>
        {ownerId && (
          <Text size="sm" className="break-all">
            Owner: {ownerId}
          </Text>
        )}
        {spec.description && <Text size="sm">{spec.description}</Text>}
      </BlockStack>
      <div className="min-h-0 flex-1">
        <CodeViewer
          code={dump(selected ?? serialized, { noRefs: true })}
          filename={entity ? "Node configuration" : "Pipeline configuration"}
        />
      </div>
    </aside>
  );
});
