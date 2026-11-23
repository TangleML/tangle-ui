import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactFlowProps, XYPosition } from "@xyflow/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type PickOutcome,
  yamlErrorOutcome,
} from "@/components/shared/FilePicker";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { componentSpecFromYaml } from "@/utils/yaml";

import { FlowCanvas } from "./FlowCanvas";
import { useFileDropHandler } from "./hooks/useFileDropHandler";

const mocks = vi.hoisted(() => ({
  fileDrop: vi.fn(),
  flow: {
    screenToFlowPosition: ({ x, y }: XYPosition) => ({
      x: x - 100,
      y: y - 50,
    }),
    flowToScreenPosition: ({ x, y }: XYPosition) => ({
      x: x + 100,
      y: y + 50,
    }),
  },
}));

vi.mock("@xyflow/react", async (original) => ({
  ...(await original<typeof import("@xyflow/react")>()),
  ReactFlow: ({
    children,
    onInit,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
    onDropCapture,
    onPointerDownCapture,
  }: ReactFlowProps) => {
    useEffect(() => {
      onInit?.(mocks.flow as never);
    }, [onInit]);
    return (
      <div
        data-testid="react-flow"
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDropCapture={onDropCapture}
        onPointerDownCapture={onPointerDownCapture}
      >
        <div data-testid="pane" />
        {children}
      </div>
    );
  },
  Background: () => null,
  useConnection: () => false,
  useReactFlow: () => mocks.flow,
}));
vi.mock("./hooks/useFileDropHandler", () => ({
  useFileDropHandler: vi.fn(() => mocks.fileDrop),
}));
vi.mock("./hooks/useValidateComponentDrop", () => ({
  useValidateComponentDrop: () => vi.fn(),
}));
vi.mock("./hooks/useReplaceDropHandler", () => ({
  useReplaceDropHandler: () => ({
    detectReplaceTarget: vi.fn(),
    flushReplaceState: () => null,
    performReplaceDrop: vi.fn(),
  }),
}));
vi.mock("./hooks/useClipboardShortcuts", () => ({
  useClipboardShortcuts: () => {},
}));
vi.mock("./hooks/useConnectionBehavior", () => ({
  useConnectionBehavior: () => ({}),
}));
vi.mock("./hooks/useFlowCanvasOnBeforeDelete", () => ({
  useFlowCanvasOnBeforeDelete: () => vi.fn(),
}));
vi.mock("./hooks/useNodeEdgeChanges", () => ({
  useNodeEdgeChanges: () => ({}),
}));
vi.mock("./hooks/usePaneClickBehavior", () => ({
  usePaneClickBehavior: () => ({}),
}));
vi.mock("./components/CanvasUndoRedo", () => ({ CanvasUndoRedo: () => null }));
vi.mock("./components/ConnectionLine", () => ({ ConnectionLine: () => null }));
vi.mock("./components/FloatingSelectionToolbar", () => ({
  FloatingSelectionToolbar: () => null,
}));
vi.mock("@/routes/v2/shared/components/SubgraphBreadcrumbs", () => ({
  SubgraphBreadcrumbs: () => null,
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useAutoLayout", () => ({
  useAutoLayout: () => {},
}));
vi.mock("@/routes/v2/shared/hooks/useDoubleClickBehavior", () => ({
  useDoubleClickBehavior: () => ({}),
}));
vi.mock("@/routes/v2/shared/hooks/useFitViewOnFocus", () => ({
  useFitViewOnFocus: () => {},
}));
vi.mock("@/routes/v2/shared/hooks/useFitViewOnRequest", () => ({
  useFitViewOnRequest: () => {},
}));
vi.mock("@/routes/v2/shared/hooks/useFlowCanvasState", () => ({
  useFlowCanvasState: () => ({
    displayNodes: [],
    displayEdges: [],
    onEdgeClick: vi.fn(),
    rfOnNodesChange: vi.fn(),
    rfOnEdgesChange: vi.fn(),
    selectionBehavior: {},
  }),
}));
vi.mock("@/routes/v2/shared/hooks/useFocusMode", () => ({
  focusModeStore: { active: false },
}));
vi.mock("@/routes/v2/shared/hooks/useIsDetailedView", () => ({
  useIsDetailedView: () => true,
}));
vi.mock("@/routes/v2/shared/nodes/NodeRegistryContext", () => ({
  useNodeRegistry: () => ({
    getNodeTypes: () => ({}),
    getEdgeTypes: () => ({}),
    all: () => [],
  }),
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({
    keyboard: { pressed: new Set() },
    editor: {
      setDraggedSincePointerDown: vi.fn(),
      requestContextPanelReveal: vi.fn(),
    },
    navigation: { activeSpec: null },
  }),
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => ({ undo: {} }),
}));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

const spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
  name: "Existing pipeline",
  implementation: { graph: { tasks: {} } },
});

const componentText = `name: Search
implementation:
  container:
    image: python:3.12
`;

const success: PickOutcome = {
  status: "success",
  message: "Search added to the canvas",
};

function yamlFile(name = "component.yaml", text = componentText) {
  return new File([text], name);
}

function syntaxErrorOutcome(text: string) {
  try {
    componentSpecFromYaml(text);
  } catch (error) {
    return yamlErrorOutcome(error);
  }
  throw new Error(`Expected a YAML syntax error for ${text}`);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const settleOutsideAct = () =>
  new Promise((done) => {
    setTimeout(done, 0);
  });

function renderCanvas({ readOnly }: { readOnly?: boolean } = {}) {
  return render(<FlowCanvas spec={spec} readOnly={readOnly} />);
}

function dropFile(file: File) {
  const root = screen.getByTestId("react-flow");
  const event = createEvent.drop(root, {
    dataTransfer: { files: [file], types: ["Files"], getData: () => "" },
  });
  // jsdom has no DragEvent, so the pointer coordinates are set on the event directly.
  Object.defineProperties(event, {
    clientX: { value: 300 },
    clientY: { value: 250 },
  });
  fireEvent(root, event);
}

async function showErrorCard() {
  renderCanvas();
  dropFile(yamlFile("x.json"));
  return screen.findByRole("alert");
}

beforeEach(() => {
  mocks.fileDrop.mockReset();
  mocks.fileDrop.mockResolvedValue(success);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("hands a file dropped on the canvas to the drop handler with the flow position", async () => {
  renderCanvas();
  dropFile(yamlFile());
  await waitFor(() =>
    expect(mocks.fileDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        text: componentText,
        position: { x: 200, y: 200 },
      }),
    ),
  );
});

it("passes the spec it renders to the drop handler hook", () => {
  vi.mocked(useFileDropHandler).mockClear();
  renderCanvas();
  expect(useFileDropHandler).toHaveBeenCalledWith(spec);
});

it("shows the success outcome of a dropped file in the card", async () => {
  renderCanvas();
  dropFile(yamlFile());
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Search added to the canvas",
  );
});

it("shows a wrong-extension error in the card without calling the drop handler", async () => {
  const alert = await showErrorCard();
  expect(alert).toHaveTextContent("x.json isn't a .yaml or .yml file.");
  expect(mocks.fileDrop).not.toHaveBeenCalled();
});

it("shows a YAML syntax error with its prefix in the card", async () => {
  const text = "name: [unclosed";
  mocks.fileDrop.mockResolvedValue(syntaxErrorOutcome(text));
  renderCanvas();
  dropFile(yamlFile("broken.yaml", text));
  expect(
    await screen.findByText(/^YAML syntax error: unexpected end of the stream/),
  ).toBeInTheDocument();
});

it("dismisses the card with its dismiss button", async () => {
  await showErrorCard();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("dismisses the card on Escape with focus on its dismiss button", async () => {
  await showErrorCard();
  const dismiss = screen.getByRole("button", { name: "Dismiss" });
  dismiss.focus();
  fireEvent.keyDown(dismiss, { key: "Escape" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("keeps an Escape that dismisses the card from reaching window keydown listeners", async () => {
  await showErrorCard();
  const windowKeyDown = vi.fn();
  window.addEventListener("keydown", windowKeyDown);
  const dismiss = screen.getByRole("button", { name: "Dismiss" });
  dismiss.focus();
  fireEvent.keyDown(dismiss, { key: "Escape" });
  window.removeEventListener("keydown", windowKeyDown);
  expect(windowKeyDown).not.toHaveBeenCalled();
});

it("keeps the card and lets a non-Escape key on its dismiss button reach window keydown listeners", async () => {
  await showErrorCard();
  const windowKeyDown = vi.fn();
  window.addEventListener("keydown", windowKeyDown);
  const dismiss = screen.getByRole("button", { name: "Dismiss" });
  dismiss.focus();
  fireEvent.keyDown(dismiss, { key: "a" });
  window.removeEventListener("keydown", windowKeyDown);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(windowKeyDown).toHaveBeenCalledTimes(1);
});

it("dismisses the card on a pointerdown on the pane", async () => {
  await showErrorCard();
  fireEvent.pointerDown(screen.getByTestId("pane"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("clears the card of a previous drop before showing the next drop's outcome", async () => {
  const pending = deferred<PickOutcome>();
  mocks.fileDrop.mockReturnValue(pending.promise);
  await showErrorCard();
  dropFile(yamlFile("b.yaml"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(await screen.findByText("Reading b.yaml…")).toBeInTheDocument();
  pending.resolve(success);
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Search added to the canvas",
  );
});

it("clears the card of a previous drop when the next drop carries no file", async () => {
  await showErrorCard();
  const root = screen.getByTestId("react-flow");
  fireEvent.drop(root, {
    dataTransfer: { files: [], types: [], getData: () => "" },
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows the drop highlight while a file is dragged over the canvas and hides it when the drag leaves", () => {
  renderCanvas();
  const root = screen.getByTestId("react-flow");
  fireEvent.dragEnter(root, { dataTransfer: { types: ["Files"] } });
  expect(screen.getByText("Drop to add this component")).toBeInTheDocument();
  fireEvent.dragLeave(root, { dataTransfer: { types: ["Files"] } });
  expect(
    screen.queryByText("Drop to add this component"),
  ).not.toBeInTheDocument();
});

it("shows no drop highlight while a drag without files is over the canvas", () => {
  renderCanvas();
  fireEvent.dragEnter(screen.getByTestId("react-flow"), {
    dataTransfer: { types: ["text/plain"] },
  });
  expect(
    screen.queryByText("Drop to add this component"),
  ).not.toBeInTheDocument();
});

describe("when read-only", () => {
  it("shows no drop highlight while a file is dragged over the canvas", () => {
    renderCanvas({ readOnly: true });
    fireEvent.dragEnter(screen.getByTestId("react-flow"), {
      dataTransfer: { types: ["Files"] },
    });
    expect(
      screen.queryByText("Drop to add this component"),
    ).not.toBeInTheDocument();
  });

  it("shows no card for a dropped file", async () => {
    renderCanvas({ readOnly: true });
    dropFile(yamlFile());
    await settleOutsideAct();
    expect(
      screen.queryByText("Reading component.yaml…"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("acquires no window drop guard", () => {
    const addWindowListener = vi.spyOn(window, "addEventListener");
    renderCanvas({ readOnly: true });
    expect(addWindowListener).not.toHaveBeenCalledWith(
      "drop",
      expect.any(Function),
    );
  });
});
