import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorTourBridge } from "./EditorTourBridge";

type Task = { $id: string; name: string; arguments: unknown[] };

const setCurrentStep = vi.fn();
const selectNode = vi.fn();
const markStepComplete = vi.fn();
const isStepComplete = vi.fn<(step: number) => boolean>(() => false);

let editorState: {
  selectedNodeType: string | null;
  selectedNodeId: string | null;
  multiSelection: unknown[];
  selectNode: typeof selectNode;
};
let navigationState: { activeSpec: { tasks: Task[] } | null };
let tourState: {
  isOpen: boolean;
  currentStep: number;
  steps: Record<string, unknown>[];
  setCurrentStep: typeof setCurrentStep;
  setSteps: ReturnType<typeof vi.fn>;
};

vi.mock("@reactour/tour", () => ({
  useTour: () => tourState,
}));

vi.mock("@xyflow/react", () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({
    windows: { getWindowById: () => undefined, getAllWindows: () => [] },
    navigation: navigationState,
    editor: editorState,
  }),
}));

vi.mock("@/providers/TourProvider/TourProgressContext", () => ({
  useTourProgress: () => ({ markStepComplete, isStepComplete }),
}));

const trainTask: Task = {
  $id: "task-train",
  name: "Train XGBoost model on CSV",
  arguments: [],
};

function renderBridge(opts: {
  selectedNodeId?: string | null;
  selectedNodeType?: string | null;
  tasks?: Task[];
  stepComplete?: boolean;
}) {
  isStepComplete.mockReturnValue(opts.stepComplete ?? false);
  editorState = {
    selectedNodeType: opts.selectedNodeType ?? null,
    selectedNodeId: opts.selectedNodeId ?? null,
    multiSelection: [],
    selectNode,
  };
  navigationState = {
    activeSpec: { tasks: opts.tasks ?? [trainTask] },
  };
  tourState = {
    isOpen: true,
    currentStep: 1,
    steps: [
      {
        selector: "body",
        content: "select",
        interaction: "select-task",
        targetTaskName: trainTask.name,
      },
      {
        selector: "body",
        content: "requires",
        requiresTaskSelected: trainTask.name,
      },
    ],
    setCurrentStep,
    setSteps: vi.fn(),
  };
  return render(<EditorTourBridge />);
}

describe("EditorTourBridge requiresTaskSelected guard", () => {
  afterEach(() => vi.clearAllMocks());

  it("re-asserts the required selection instead of navigating backward", () => {
    renderBridge({ selectedNodeType: null, selectedNodeId: null });

    expect(selectNode).toHaveBeenCalledWith(trainTask.$id, "task");
    expect(setCurrentStep).not.toHaveBeenCalled();
  });

  it("does nothing when the required task is already selected", () => {
    renderBridge({
      selectedNodeType: "task",
      selectedNodeId: trainTask.$id,
    });

    expect(selectNode).not.toHaveBeenCalled();
    expect(setCurrentStep).not.toHaveBeenCalled();
  });

  it("never bounces back onto an already-completed select-task step", () => {
    renderBridge({
      selectedNodeType: null,
      selectedNodeId: null,
      tasks: [],
      stepComplete: true,
    });

    expect(selectNode).not.toHaveBeenCalled();
    expect(setCurrentStep).not.toHaveBeenCalled();
  });

  it("falls back to the select-task step only when the task is gone and that step is not complete", () => {
    renderBridge({
      selectedNodeType: null,
      selectedNodeId: null,
      tasks: [],
      stepComplete: false,
    });

    expect(selectNode).not.toHaveBeenCalled();
    expect(setCurrentStep).toHaveBeenCalledWith(0);
  });
});
