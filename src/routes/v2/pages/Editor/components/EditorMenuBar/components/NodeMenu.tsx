import { useReactFlow } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import {
  bringToFront,
  moveBackward,
  moveForward,
  sendToBack,
} from "@/components/shared/ReactFlow/FlowCanvas/utils/zIndex";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";
import type { ComponentSpec } from "@/models/componentSpec";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { getErrorMessage } from "@/utils/string";

function findEntityAnnotations(spec: ComponentSpec, entityId: string) {
  for (const t of spec.tasks) if (t.$id === entityId) return t.annotations;
  for (const i of spec.inputs) if (i.$id === entityId) return i.annotations;
  for (const o of spec.outputs) if (o.$id === entityId) return o.annotations;
  return null;
}

export const NodeMenu = observer(function NodeMenu() {
  const { editor, navigation } = useSharedStores();
  const { undo } = useEditorSession();
  const spec = navigation.activeSpec;
  const { deleteTask, duplicateSelectedNodes, unpackSubgraphTask } =
    useTaskActions();
  const notify = useToastNotification();
  const { getNodes } = useReactFlow();

  const entityId = editor.selectedNodeId;
  const nodeType = editor.selectedNodeType;

  if (!entityId || !nodeType || !spec) return null;

  const isTask = nodeType === "task";
  const task = isTask ? spec.tasks.find((t) => t.$id === entityId) : null;

  const annotations = findEntityAnnotations(spec, entityId);
  if (!annotations) return null;

  const isSubgraph = isTask && task ? task.subgraphSpec !== undefined : false;

  const handleDuplicate = () => {
    if (!task) return;
    const position = task.annotations.get("editor.position") ?? {
      x: 0,
      y: 0,
    };
    try {
      duplicateSelectedNodes(spec, [{ id: entityId, type: "task", position }]);
      notify("Task duplicated", "success");
    } catch (error) {
      notify("Failed to duplicate task: " + getErrorMessage(error), "error");
    }
  };

  const handleDelete = () => {
    try {
      deleteTask(spec, entityId);
      editor.clearSelection();
      editor.clearMultiSelection();
    } catch (error) {
      notify("Failed to delete task: " + getErrorMessage(error), "error");
    }
  };

  const handleUnpack = () => {
    try {
      unpackSubgraphTask(spec, entityId);
      notify("Subgraph unpacked", "success");
    } catch (error) {
      notify("Failed to unpack subgraph: " + getErrorMessage(error), "error");
    }
  };

  const handleZIndex = (
    operation: "front" | "back" | "forward" | "backward",
  ) => {
    const nodes = getNodes();
    const currentNode = nodes.find((n) => n.id === entityId);
    if (!currentNode) return;

    let newZIndex: number;
    switch (operation) {
      case "front":
        newZIndex = bringToFront(currentNode, nodes);
        break;
      case "back":
        newZIndex = sendToBack(currentNode, nodes);
        break;
      case "forward":
        newZIndex = moveForward(currentNode, nodes);
        break;
      case "backward":
        newZIndex = moveBackward(currentNode, nodes);
        break;
    }

    undo.withGroup("Update node z-index", () => {
      annotations.set("zIndex", newZIndex);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton>Node</MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        {isTask && (
          <>
            <DropdownMenuItem onSelect={handleDuplicate}>
              <Icon name="Copy" size="sm" />
              Duplicate Task
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Icon name="Layers" size="sm" />
            Arrange
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => handleZIndex("forward")}>
              <Icon name="ArrowUpFromLine" size="sm" />
              Move Forward
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleZIndex("backward")}>
              <Icon name="ArrowDownFromLine" size="sm" />
              Move Backward
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => handleZIndex("front")}>
              <Icon name="ListStart" size="sm" />
              Bring to Front
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleZIndex("back")}>
              <Icon name="ListEnd" size="sm" />
              Send to Back
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {isSubgraph && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleUnpack}>
              <Icon name="PackageOpen" size="sm" />
              Unpack Subgraph
            </DropdownMenuItem>
          </>
        )}

        {isTask && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Icon name="Trash" size="sm" />
              Delete Task
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
