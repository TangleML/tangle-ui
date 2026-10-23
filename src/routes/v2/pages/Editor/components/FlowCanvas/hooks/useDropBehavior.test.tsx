import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactFlowInstance } from "@xyflow/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { UndoStore } from "@/routes/v2/pages/Editor/store/undoStore";
import { componentSpecValidatorQuery } from "@/services/componentSpecValidation";

import { useDropBehavior } from "./useDropBehavior";

const mocks = vi.hoisted(() => ({
  hydrate: vi.fn(),
  drop: vi.fn(),
  replace: vi.fn(),
  flushReplaceState: vi.fn(),
  addToLibrary: vi.fn(),
  addTask: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));
vi.mock("@/services/componentService", () => ({
  hydrateComponentReference: mocks.hydrate,
}));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: mocks.track }),
}));
vi.mock("@/routes/v2/shared/nodes/NodeRegistryContext", () => ({
  useNodeRegistry: () => ({
    all: () => [{ drop: { dataKey: "task", handler: mocks.drop } }],
  }),
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => ({ undo }),
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ navigation }),
}));
vi.mock("./useReplaceDropHandler", () => ({
  useReplaceDropHandler: () => ({
    detectReplaceTarget: vi.fn(),
    flushReplaceState: mocks.flushReplaceState,
    performReplaceDrop: mocks.replace,
  }),
}));
vi.mock("@/providers/ComponentLibraryProvider", () => ({
  useComponentLibrary: () => ({ addToComponentLibrary: mocks.addToLibrary }),
}));
vi.mock("@/routes/v2/pages/Editor/store/actions/useTaskActions", () => ({
  useTaskActions: () => ({ addTask: mocks.addTask }),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));
vi.mock("@/utils/dom", () => ({
  readTextFromFile: async () => "name: Search",
}));

const spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
  name: "Existing pipeline",
  implementation: { graph: { tasks: {} } },
});
const navigation = { activeSpec: spec };
const undo = new UndoStore();
let client: QueryClient;
const validate = vi.fn();
const component = {
  name: "Search",
  digest: "search-digest",
  text: "name: Search",
  spec: {
    name: "Search",
    implementation: { container: { image: "python:3.12" } },
  },
};

const flow = {
  screenToFlowPosition: () => ({ x: 200, y: 200 }),
} as unknown as ReactFlowInstance;

function Canvas() {
  const behavior = useDropBehavior(spec, flow);
  return <div data-testid="canvas" onDrop={behavior.onDrop} />;
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <DialogProvider disableRouterSync>{children}</DialogProvider>
    </QueryClientProvider>
  );
}

function drop(file = false) {
  fireEvent.drop(screen.getByTestId("canvas"), {
    dataTransfer: {
      files: file ? [new File(["name: Search"], "component.yaml")] : [],
      getData: () => JSON.stringify({ task: { componentRef: component } }),
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.activeSpec = spec;
  undo.init(spec);
  mocks.hydrate.mockResolvedValue(component);
  mocks.flushReplaceState.mockReturnValue(null);
  validate.mockReturnValue({
    valid: false,
    errors: ["inputs[5].default: Expected a string. Quote numeric defaults."],
  });
  client = new QueryClient();
  client.setQueryData(componentSpecValidatorQuery.queryKey, () => validate);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  client.clear();
  undo.dispose();
  vi.unstubAllGlobals();
});

it.each(["library", "replacement", "file"])(
  "rejects an invalid %s drop without changing the pipeline",
  async (source) => {
    if (source === "replacement")
      mocks.flushReplaceState.mockReturnValue("existing-task");
    render(<Canvas />, { wrapper: Wrapper });
    drop(source === "file");
    expect(
      await screen.findByRole("dialog", { name: "Invalid component" }),
    ).toBeVisible();
    expect(
      screen.getByText('"Search" was not added to the pipeline.'),
    ).toBeVisible();
    expect(
      screen.getByText(/inputs\[5\].default: Expected a string/),
    ).toBeVisible();
    expect(mocks.drop).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.addToLibrary).not.toHaveBeenCalled();
    expect(mocks.addTask).not.toHaveBeenCalled();
    expect(undo.undoLevels).toBe(0);
    expect(spec.tasks).toHaveLength(0);
    expect(mocks.track).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Close", { selector: "button" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
);

it("continues accepting valid library components after dismissing an invalid one", async () => {
  render(<Canvas />, { wrapper: Wrapper });
  drop();
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByText("Close", { selector: "button" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  validate.mockReturnValue({ valid: true });
  drop();
  await waitFor(() => expect(mocks.drop).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("blocks a component load failure and allows retrying the drop", async () => {
  mocks.hydrate.mockRejectedValueOnce(new Error("Offline"));
  render(<Canvas />, { wrapper: Wrapper });
  drop();
  expect(
    await screen.findByRole("dialog", { name: "Unable to validate component" }),
  ).toBeVisible();
  expect(mocks.drop).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Close", { selector: "button" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  validate.mockReturnValue({ valid: true });
  drop();
  await waitFor(() => expect(mocks.drop).toHaveBeenCalledTimes(1));
});

it("does not add a component if the active pipeline changes during validation", async () => {
  let finish: ((value: typeof component) => void) | undefined;
  mocks.hydrate.mockImplementation(
    () =>
      new Promise<typeof component>((resolve) => {
        finish = resolve;
      }),
  );
  validate.mockReturnValue({ valid: true });
  render(<Canvas />, { wrapper: Wrapper });
  drop();
  navigation.activeSpec = new YamlDeserializer(
    new IncrementingIdGenerator(),
  ).deserialize({
    name: "Other pipeline",
    implementation: { graph: { tasks: {} } },
  });
  finish?.(component);
  await waitFor(() => expect(validate).toHaveBeenCalled());
  expect(mocks.drop).not.toHaveBeenCalled();
});
