import { observer } from "mobx-react-lite";

import { TaskDetails, TaskIO } from "@/components/shared/TaskDetails";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { serializeComponentSpec } from "@/models/componentSpec";
import { CodeBlock } from "@/routes/v2/shared/components/CodeBlock";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { tracking } from "@/utils/tracking";
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
  const componentSpec = task.resolvedComponentSpec;
  const code = (() => {
    if (componentRef.text) return componentRef.text;
    if (task.subgraphSpec) {
      return componentSpecToText(serializeComponentSpec(task.subgraphSpec));
    }
    return componentRef.spec
      ? componentSpecToText(
          componentRef.spec as Parameters<typeof componentSpecToText>[0],
        )
      : "";
  })();

  return (
    <BlockStack className="h-full w-full bg-white overflow-hidden">
      <Tabs
        defaultValue="details"
        className="flex flex-col flex-1 min-h-0 min-w-0 w-full"
      >
        <TabsList className="mx-3 mt-3 shrink-0 w-auto">
          <TabsTrigger
            value="details"
            className="flex-1 gap-1 min-w-0"
            {...tracking("v2.pipeline_editor.pinned_task_window.tab_details")}
          >
            <Icon name="Info" size="sm" className="shrink-0" />
            <span className="truncate">Details</span>
          </TabsTrigger>
          <TabsTrigger
            value="io"
            className="flex-1 gap-1 min-w-0"
            {...tracking("v2.pipeline_editor.pinned_task_window.tab_io")}
          >
            <Icon name="ListFilter" size="sm" className="shrink-0" />
            <span className="truncate">I/O</span>
          </TabsTrigger>
          <TabsTrigger
            value="implementation"
            className="flex-1 gap-1 min-w-0"
            {...tracking(
              "v2.pipeline_editor.pinned_task_window.tab_implementation",
            )}
          >
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
              <EmptyState description="No inputs or outputs defined" />
            )}
          </TabsContent>

          <TabsContent
            value="implementation"
            className="mt-0 min-w-0 h-full flex-1"
          >
            {code ? (
              <CodeBlock code={code} language="yaml" showLineNumbers={false} />
            ) : (
              <EmptyState description="No implementation code available" />
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
    <EmptyState
      icon="CircleAlert"
      title="Task not found"
      description={
        <Text size="xs" tone="subdued" font="mono">
          {entityId}
        </Text>
      }
      className="bg-white"
    />
  );
}
