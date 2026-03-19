import { observer } from "mobx-react-lite";

import { TaskDetails, TaskIO } from "@/components/shared/TaskDetails";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { CodeBlock } from "@/routes/v2/pages/Editor/components/CodeBlock";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { componentSpecToText } from "@/utils/yaml";

interface PinnedTaskContentProps {
  /** The entity ID of the task to display */
  entityId: string;
}

/**
 * Content for a pinned task window.
 * Shows details for a specific task, independent of the current selection.
 * Used for shift-click "pinned" windows.
 */
export const PinnedTaskContent = observer(function PinnedTaskContent({
  entityId,
}: PinnedTaskContentProps) {
  const spec = useSpec();

  if (!spec) {
    return <NotFoundState entityId={entityId} />;
  }

  const task = spec.tasks.find((t) => t.$id === entityId);
  if (!task) {
    return <NotFoundState entityId={entityId} />;
  }

  const componentRef = task.componentRef;
  const componentSpec = componentRef.spec;
  const code =
    componentRef.text ??
    (componentSpec
      ? componentSpecToText(
          componentSpec as Parameters<typeof componentSpecToText>[0],
        )
      : "");

  return (
    <BlockStack className="h-full w-full bg-white overflow-hidden">
      <Tabs
        defaultValue="details"
        className="flex flex-col flex-1 min-h-0 min-w-0 w-full"
      >
        <TabsList className="mx-3 mt-3 shrink-0 w-auto">
          <TabsTrigger value="details" className="flex-1 gap-1 min-w-0">
            <Icon name="Info" size="sm" className="shrink-0" />
            <span className="truncate">Details</span>
          </TabsTrigger>
          <TabsTrigger value="io" className="flex-1 gap-1 min-w-0">
            <Icon name="ListFilter" size="sm" className="shrink-0" />
            <span className="truncate">I/O</span>
          </TabsTrigger>
          <TabsTrigger value="implementation" className="flex-1 gap-1 min-w-0">
            <Icon name="Code" size="sm" className="shrink-0" />
            <span className="truncate">Code</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 min-w-0 flex flex-col p-3">
          <TabsContent value="details" className="mt-0 min-w-0 overflow-auto">
            <TaskDetails
              componentRef={
                componentRef as Parameters<
                  typeof TaskDetails
                >[0]["componentRef"]
              }
              readOnly
              options={{ descriptionExpanded: true }}
            />
          </TabsContent>

          <TabsContent value="io" className="mt-0 min-w-0 overflow-auto">
            {componentSpec ? (
              <TaskIO
                componentSpec={
                  componentSpec as Parameters<typeof TaskIO>[0]["componentSpec"]
                }
              />
            ) : (
              <EmptyState message="No inputs or outputs defined" />
            )}
          </TabsContent>

          <TabsContent
            value="implementation"
            className="mt-0 min-w-0 h-full flex-1"
          >
            {code ? (
              <CodeBlock code={code} language="yaml" showLineNumbers={false} />
            ) : (
              <EmptyState message="No implementation code available" />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </BlockStack>
  );
});

interface NotFoundStateProps {
  entityId: string;
}

function NotFoundState({ entityId }: NotFoundStateProps) {
  return (
    <BlockStack className="h-full items-center justify-center p-4 bg-white">
      <Icon name="CircleAlert" size="lg" className="text-gray-300" />
      <Text size="sm" tone="subdued" className="text-center mt-2">
        Task not found
      </Text>
      <Text size="xs" tone="subdued" className="text-center font-mono">
        {entityId}
      </Text>
    </BlockStack>
  );
}

interface EmptyStateProps {
  message: string;
}

function EmptyState({ message }: EmptyStateProps) {
  return (
    <BlockStack className="items-center justify-center p-4">
      <Text size="sm" tone="subdued">
        {message}
      </Text>
    </BlockStack>
  );
}
