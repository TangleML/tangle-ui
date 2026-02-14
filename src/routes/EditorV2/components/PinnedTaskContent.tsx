import { useSnapshot } from "valtio";

import { CodeBlock } from "@/components/shared/CodeViewer/CodeBlock";
import { TaskDetails, TaskIO } from "@/components/shared/TaskDetails";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";
import { componentSpecToText } from "@/utils/yaml";

import { editorStore } from "../store/editorStore";

interface PinnedTaskContentProps {
  /** The entity ID of the task to display */
  entityId: string;
}

/**
 * Content for a pinned task window.
 * Shows details for a specific task, independent of the current selection.
 * Used for shift-click "pinned" windows.
 */
export function PinnedTaskContent({ entityId }: PinnedTaskContentProps) {
  const snapshot = useSnapshot(editorStore);
  const spec = snapshot.spec;

  if (
    !spec?.implementation ||
    !(spec.implementation instanceof GraphImplementation)
  ) {
    return <NotFoundState entityId={entityId} />;
  }

  // Get task directly from entities using $id
  const task = spec.implementation.tasks.entities[entityId];
  if (!task) {
    return <NotFoundState entityId={entityId} />;
  }

  const componentRef = task.componentRef;
  const componentSpec = componentRef.spec;
  const code =
    componentRef.text ??
    (componentSpec ? componentSpecToText(componentSpec) : "");

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
              componentRef={componentRef}
              readOnly
              options={{ descriptionExpanded: true }}
            />
          </TabsContent>

          <TabsContent value="io" className="mt-0 min-w-0 overflow-auto">
            {componentSpec ? (
              <TaskIO componentSpec={componentSpec} />
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
}

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
