import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Binding, ComponentSpec, Task } from "@/models/componentSpec";
import { DynamicWorkarea } from "@/routes/v2/pages/Tangent/components/DynamicWorkarea";
import { WorkareaToggle } from "@/routes/v2/pages/Tangent/components/ProjectHeader";
import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import type { WorkareaHostProps } from "@/routes/v2/pages/Tangent/workarea/types";
import { useShortcutListener } from "@/routes/v2/shared/shortcuts/useShortcutListener";
import { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { FlowCanvas } from "./FlowCanvas";

let project: TangentProjectStore;
let keyboard: KeyboardStore;
let spec: ComponentSpec;
const undoGroup = vi.fn((_label: string, apply: () => void) => apply());
const clearSelection = vi.fn();
const clearMultiSelection = vi.fn();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => project,
}));
vi.mock("@/routes/v2/pages/Tangent/workarea/registry", () => ({
  registerWorkareaKind: vi.fn(),
  getWorkareaKind: () => ({
    keepMounted: true,
    icon: "GitBranch",
    render: (_tab: unknown, host: WorkareaHostProps) => (
      <WorkareaCanvas active={host.isActive} />
    ),
  }),
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({
    keyboard,
    editor: { clearSelection, clearMultiSelection },
    navigation: { parentContext: undefined },
  }),
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => ({ undo: { withGroup: undoGroup } }),
}));
vi.mock("@/routes/v2/shared/nodes/NodeRegistryContext", () => ({
  useNodeRegistry: () => ({
    getNodeTypes: () => ({}),
    getEdgeTypes: () => ({}),
    getByNodeId: () => ({
      entityType: "task",
      getPosition: () => ({ x: 0, y: 0 }),
    }),
  }),
}));
vi.mock("@/routes/v2/pages/Editor/nodes", () => ({
  editorRegistry: {
    getByNodeId: () => ({
      deleteNode: (_undo: unknown, current: ComponentSpec, id: string) =>
        current.deleteTaskById(id),
    }),
  },
}));
vi.mock("@/routes/v2/shared/hooks/useFlowCanvasState", () => ({
  useFlowCanvasState: () => ({
    displayNodes: [
      {
        id: "task_1",
        position: { x: 0, y: 0 },
        data: { label: "Selected task" },
        selected: true,
      },
    ],
    displayEdges: [
      {
        id: "edge_binding_1",
        source: "task_1",
        target: "task_1",
        selected: true,
      },
    ],
    selectionBehavior: {},
  }),
}));
vi.mock("@/routes/v2/shared/hooks/useViewportScaling", () => ({
  useViewportScaling: () => ({
    containerRef: undefined,
    handleViewportChange: undefined,
  }),
}));
vi.mock("@/routes/v2/shared/hooks/useIsDetailedView", () => ({
  useIsDetailedView: () => true,
}));
vi.mock("@/routes/v2/shared/components/SubgraphBreadcrumbs", () => ({
  SubgraphBreadcrumbs: () => null,
}));
vi.mock("./components/CanvasUndoRedo", () => ({ CanvasUndoRedo: () => null }));
vi.mock("./components/FloatingSelectionToolbar", () => ({
  FloatingSelectionToolbar: () => null,
}));
vi.mock("@/routes/v2/shared/hooks/useFitViewOnFocus", () => ({
  useFitViewOnFocus: vi.fn(),
}));
vi.mock("@/routes/v2/shared/hooks/useFitViewOnRequest", () => ({
  useFitViewOnRequest: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useAutoLayout", () => ({
  useAutoLayout: vi.fn(),
}));
vi.mock("./hooks/useClipboardShortcuts", () => ({
  useClipboardShortcuts: vi.fn(),
}));
vi.mock("./hooks/useNodeEdgeChanges", () => ({
  useNodeEdgeChanges: () => ({}),
}));
vi.mock("./hooks/useConnectionBehavior", () => ({
  useConnectionBehavior: () => ({}),
}));
vi.mock("./hooks/useDropBehavior", () => ({ useDropBehavior: () => ({}) }));
vi.mock("@/routes/v2/shared/hooks/useDoubleClickBehavior", () => ({
  useDoubleClickBehavior: () => ({}),
}));
vi.mock("./hooks/usePaneClickBehavior", () => ({
  usePaneClickBehavior: () => ({}),
}));

let deleteProgrammatically: () => Promise<unknown>;
function FlowProbe() {
  const flow = useReactFlow();
  useEffect(() => {
    deleteProgrammatically = () =>
      flow.deleteElements({ nodes: [{ id: "task_1" }] });
  }, [flow]);
  return null;
}
function WorkareaCanvas({ active }: { active: boolean }) {
  useShortcutListener(active);
  return (
    <ReactFlowProvider>
      <FlowCanvas spec={spec} />
      <FlowProbe />
    </ReactFlowProvider>
  );
}
function Fixture() {
  return (
    <>
      <WorkareaToggle />
      <DynamicWorkarea />
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  project = new TangentProjectStore("project-1");
  project.setDefaultSessionId("session-1");
  project.openResolvedView({
    title: "Pipeline",
    target: { type: "pipeline", identity: "id/p1" },
  });
  keyboard = new KeyboardStore();
  spec = new ComponentSpec({ name: "Pipeline" });
  spec.addTask(
    new Task({ $id: "task_1", name: "Selected task", componentRef: {} }),
  );
  spec.addBinding(
    new Binding({
      $id: "binding_1",
      sourceEntityId: "task_1",
      sourcePortName: "output",
      targetEntityId: "task_1",
      targetPortName: "input",
    }),
  );
});

describe("real ReactFlow keyboard activity", () => {
  it.each(["Delete", "Backspace"])(
    "does not mutate hidden spec/undo on %s at the Show button, retains selection and resumes after restore",
    async (key) => {
      render(<Fixture />);
      expect(keyboard.listening).toBe(true);
      expect(spec.tasks).toHaveLength(1);
      expect(spec.bindings).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: "Hide workarea" }));
      const show = screen.getByRole("button", { name: "Show workarea" });
      show.focus();
      expect(keyboard.listening).toBe(false);
      await act(async () => {
        fireEvent.keyDown(show, { key, code: key });
        fireEvent.keyUp(show, { key, code: key });
      });
      expect(show).toHaveFocus();
      expect(spec.tasks).toHaveLength(1);
      expect(spec.bindings).toHaveLength(1);
      expect(undoGroup).not.toHaveBeenCalled();
      expect(clearSelection).not.toHaveBeenCalled();
      expect(clearMultiSelection).not.toHaveBeenCalled();
      fireEvent.click(show);
      const hide = screen.getByRole("button", { name: "Hide workarea" });
      hide.focus();
      fireEvent.keyDown(hide, { key, code: key });
      await waitFor(() => expect(undoGroup).toHaveBeenCalledOnce());
      expect(spec.tasks).toHaveLength(0);
      expect(spec.bindings).toHaveLength(0);
      expect(clearSelection).toHaveBeenCalledOnce();
      expect(clearMultiSelection).toHaveBeenCalledOnce();
      fireEvent.keyUp(hide, { key, code: key });
    },
  );

  it("keeps deliberate programmatic/agent deletion available while hidden", async () => {
    project.hideWorkarea();
    render(<Fixture />);
    await act(async () => {
      await deleteProgrammatically();
    });
    expect(spec.tasks).toHaveLength(0);
    expect(spec.bindings).toHaveLength(0);
    expect(undoGroup).toHaveBeenCalledOnce();
  });
});
