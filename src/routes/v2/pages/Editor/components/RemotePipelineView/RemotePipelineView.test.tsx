import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactFlowProps } from "@xyflow/react";
import { isRootStore } from "mobx-keystone";
import { type PropsWithChildren, StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import {
  IncrementingIdGenerator,
  serializeComponentSpecToText,
  YamlDeserializer,
} from "@/models/componentSpec";

import { RemotePipelineView } from "./RemotePipelineView";

let canvas: ReactFlowProps;
vi.mock("@xyflow/react", async (original) => ({
  ...(await original<typeof import("@xyflow/react")>()),
  ReactFlow: (props: ReactFlowProps) => {
    canvas = props;
    return (
      <>
        {props.nodes?.map((node) => (
          <span key={node.id}>{String(node.data.name ?? "")}</span>
        ))}
        {props.children}
      </>
    );
  },
  Controls: () => <button>Fit view</button>,
  Background: () => null,
  useNodesInitialized: () => false,
}));
vi.mock("@/routes/v2/shared/components/AppMenuActions", () => ({
  AppMenuActions: () => null,
}));
vi.mock("@/providers/ComponentLibraryProvider", () => ({
  ComponentLibraryProvider: ({ children }: PropsWithChildren) => children,
}));
vi.mock("@/routes/v2/shared/components/SubgraphBreadcrumbs", async () => {
  const { useSharedStores } =
    await import("@/routes/v2/shared/store/SharedStoreContext");
  return {
    SubgraphBreadcrumbs: () => {
      const { navigation } = useSharedStores();
      return (
        <button onClick={() => navigation.navigateToLevel(0)}>Root</button>
      );
    },
  };
});
afterEach(cleanup);

it("shows a read-only graph and navigates subgraphs without changing the spec", async () => {
  const child = { name: "Child", implementation: { graph: { tasks: {} } } };
  const spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
    name: "Remote pipeline",
    implementation: {
      graph: { tasks: { "First task": { componentRef: { spec: child } } } },
    },
  });
  const initialYaml = serializeComponentSpecToText(spec);
  const { unmount } = render(
    <StrictMode>
      <RemotePipelineView spec={spec} />
    </StrictMode>,
  );
  await screen.findByText("First task");
  expect(screen.getByText("View only")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Fit view" })).toBeInTheDocument();
  expect(canvas).toMatchObject({
    nodesConnectable: false,
    edgesReconnectable: false,
    nodesDraggable: false,
    deleteKeyCode: null,
  });
  expect(canvas.onConnect).toBeUndefined();
  expect(canvas.onDrop).toBeUndefined();
  expect(isRootStore(spec)).toBe(true);
  const node = canvas.nodes![0];
  act(() => canvas.onNodesChange?.([{ type: "remove", id: node.id }]));
  expect(screen.getByText("First task")).toBeInTheDocument();
  act(() => canvas.onNodeDoubleClick?.({} as never, node));
  expect(screen.queryByText("First task")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Root" }));
  await screen.findByText("First task");
  expect(serializeComponentSpecToText(spec)).toBe(initialYaml);
  unmount();
  expect(isRootStore(spec)).toBe(false);
});
