import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpecJson, Task } from "@/models/componentSpec";
import { ArgumentCodeEditor } from "@/routes/v2/pages/Editor/components/ArgumentCodeEditor";
import { ArgumentRow } from "@/routes/v2/pages/Editor/components/ArgumentRow/ArgumentRow";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { CTRL, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { useContentWindowState } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import {
  getWindowById,
  toggleMaximize,
} from "@/routes/v2/shared/windows/windows.actions";

interface TaskArgumentsEditorProps {
  task: Task;
}

export const TaskArgumentsEditor = observer(function TaskArgumentsEditor({
  task,
}: TaskArgumentsEditorProps) {
  const { editor, keyboard } = useSharedStores();
  const spec = useSpec();
  const windowState = useContentWindowState();
  const isMaximized = windowState?.isMaximized ?? false;
  const componentSpec = task.componentRef.spec as ComponentSpecJson | undefined;
  const inputs = componentSpec?.inputs ?? [];
  const lastSelectedArgRef = useRef<string | null>(null);

  const handleSelectionChanged = (name: string) => {
    lastSelectedArgRef.current = name;
  };

  useEffect(() => {
    return keyboard.registerShortcut({
      id: "task-arguments-editor--maximize",
      keys: [CTRL, SHIFT, "M"],
      label: "Maximize Arguments Editor",
      allowInEditable: true,
      action: () => {
        if (!windowState) return;

        const { windowId } = windowState;
        const isCurrentlyMaximized =
          getWindowById(windowId)?.state === "maximized";

        toggleMaximize(windowId);

        if (!isCurrentlyMaximized && lastSelectedArgRef.current) {
          editor.setFocusedArgument(lastSelectedArgRef.current);
        }
      },
    });
  }, [editor, keyboard, windowState]);

  if (!spec || inputs.length === 0) {
    return (
      <Text size="xs" tone="subdued" className="px-3 py-2">
        No inputs defined
      </Text>
    );
  }

  const taskBindings = spec.bindings.filter(
    (b) => b.targetEntityId === task.$id,
  );

  const argumentList = inputs.map((inputSpec) => {
    const arg = task.arguments.find((a) => a.name === inputSpec.name);
    const binding = taskBindings.find(
      (b) => b.targetPortName === inputSpec.name,
    );
    return (
      <ArgumentRow
        key={inputSpec.name}
        inputSpec={inputSpec}
        currentValue={arg?.value}
        isSet={arg !== undefined}
        binding={binding}
        task={task}
        spec={spec}
        externalEditor={isMaximized}
        onSelectionChanged={handleSelectionChanged}
      />
    );
  });

  if (!isMaximized) {
    return (
      <BlockStack gap="1" className="min-w-0 overflow-hidden">
        {argumentList}
      </BlockStack>
    );
  }

  const focusedName = editor.focusedArgumentName;
  const focusedInputSpec = focusedName
    ? inputs.find((i) => i.name === focusedName)
    : undefined;
  const focusedArg = focusedName
    ? task.arguments.find((a) => a.name === focusedName)
    : undefined;

  return (
    <InlineStack
      className="w-full min-h-[500px] h-[500px]"
      align="start"
      blockAlign="stretch"
    >
      <BlockStack
        gap="1"
        className="basis-[40%] shrink-0 min-w-0 overflow-y-auto border-r border-gray-200 py-1"
      >
        {argumentList}
      </BlockStack>

      <BlockStack
        className="basis-[60%] min-w-0 min-h-[600px] h-[600px]"
        align="stretch"
        data-testid="argument-code-editor"
      >
        {focusedInputSpec ? (
          <ArgumentCodeEditor
            inputSpec={focusedInputSpec}
            currentValue={focusedArg?.value}
            task={task}
            spec={spec}
          />
        ) : (
          <BlockStack
            align="center"
            inlineAlign="center"
            className="h-full text-gray-400"
          >
            <Text size="sm" tone="subdued">
              Select an argument to edit
            </Text>
          </BlockStack>
        )}
      </BlockStack>
    </InlineStack>
  );
});
