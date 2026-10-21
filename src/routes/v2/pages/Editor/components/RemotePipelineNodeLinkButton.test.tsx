import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { observable, runInAction } from "mobx";
import type { ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { RemotePipelineNodeType } from "@/routes/remotePipelineSearch";
import { EditorStore } from "@/routes/v2/shared/store/editorStore";
import { NavigationStore } from "@/routes/v2/shared/store/navigationStore";

import {
  EditorNodeLinkButton,
  RemotePipelineNodeLinkButton,
} from "./RemotePipelineNodeLinkButton";

const notify = vi.hoisted(() => vi.fn());
const writeText = vi.fn<(value: string) => Promise<void>>();
const clipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
const navigation = new NavigationStore(new EditorStore());
const autoSave = observable({
  isSaving: false,
  hasUnsavedChanges: false,
  error: null as string | null,
});
const file = observable<{
  id: string;
  remote?: { pipelineId: string; backendUrl: string };
}>({ id: "remote-id", remote: undefined });

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ navigation }),
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => ({
    pipelineFile: { activePipelineFile: file },
    autoSave,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  runInAction(() => {
    file.remote = undefined;
    autoSave.isSaving = false;
    autoSave.hasUnsavedChanges = false;
    autoSave.error = null;
  });
  const child = {
    name: "Nested graph",
    inputs: [{ name: "shared" }],
    outputs: [{ name: "shared" }],
    implementation: {
      graph: {
        tasks: {
          shared: {
            componentRef: {
              spec: { name: "Worker", implementation: { container: {} } },
            },
          },
        },
      },
    },
  };
  navigation.initNavigation(
    new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
      name: "Pipeline name",
      implementation: {
        graph: {
          tasks: { "nested / α & β": { componentRef: { spec: child } } },
        },
      },
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  navigation.clearNavigation();
  if (clipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
});

async function open(button: ReactElement, basepath = "/", embedded = false) {
  const root = createRootRoute();
  const route = createRoute({
    getParentRoute: () => root,
    path: embedded
      ? APP_ROUTES.TANGENT_PROJECT
      : APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
    component: () => button,
  });
  const prefix = basepath === "/" ? "" : basepath;
  const history = createMemoryHistory({
    initialEntries: [
      embedded
        ? "/tangent/project-1"
        : `${prefix}/editor-v2/pipeline/remote-id?projectId=project-1&nodeId=old&unrelated=value`,
    ],
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history,
    basepath,
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

it("copies a root node link with the deployment path and project context", async () => {
  await open(
    <RemotePipelineNodeLinkButton
      pipelineId="remote-id"
      nodeName="nested / α & β"
      nodeType="task"
    />,
    "/workspace",
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Copy node link" }),
  );
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  const link = new URL(writeText.mock.calls[0][0]);
  expect(link.pathname).toBe("/workspace/editor-v2/pipeline/remote-id");
  expect(link.searchParams.get("nodeId")).toBe("nested / α & β");
  expect(link.searchParams.get("nodeType")).toBe("task");
  expect(link.searchParams.get("projectId")).toBe("project-1");
  expect(link.searchParams.has("subgraphPath")).toBe(false);
  expect(link.searchParams.has("unrelated")).toBe(false);
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith("Link copied to clipboard", "success"),
  );
});

it.each<RemotePipelineNodeType>(["task", "input", "output"])(
  "copies a nested %s link using names and its explicit node type",
  async (nodeType) => {
    const root = navigation.rootSpec!;
    navigation.navigateToSubgraph(root, root.tasks[0].$id);
    await open(
      <RemotePipelineNodeLinkButton
        pipelineId="remote-id"
        nodeName="shared"
        nodeType={nodeType}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Copy node link" }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const link = new URL(writeText.mock.calls[0][0]);
    expect(JSON.parse(link.searchParams.get("subgraphPath")!)).toEqual([
      "nested / α & β",
    ]);
    expect(link.searchParams.get("nodeId")).toBe("shared");
    expect(link.searchParams.get("nodeType")).toBe(nodeType);
    expect(link.toString()).not.toContain("Pipeline name");
  },
);

it("shows the editor action only after the document becomes remote", async () => {
  const task = navigation.rootSpec!.tasks[0];
  await open(<EditorNodeLinkButton entityId={task.$id} nodeType="task" />);
  expect(screen.queryByRole("button", { name: "Copy node link" })).toBeNull();
  act(() => {
    runInAction(() => {
      file.remote = {
        pipelineId: file.id,
        backendUrl: "https://backend.example.com",
      };
    });
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "Copy node link" }),
  );
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  expect(new URL(writeText.mock.calls[0][0]).searchParams.get("nodeId")).toBe(
    task.name,
  );
});

it("does not report success when clipboard access fails", async () => {
  writeText.mockRejectedValue(new Error("Clipboard denied"));
  await open(
    <RemotePipelineNodeLinkButton
      pipelineId="remote-id"
      nodeName="task"
      nodeType="task"
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Copy node link" }),
  );
  await waitFor(() =>
    expect(notify).toHaveBeenCalledExactlyOnceWith(
      "Unable to copy node link",
      "error",
    ),
  );
});

it("uses the history URL when the app is deployed with hash routing", async () => {
  const router = await open(
    <RemotePipelineNodeLinkButton
      pipelineId="remote-id"
      nodeName="Task with spaces"
      nodeType="task"
    />,
  );
  vi.spyOn(router.history, "createHref").mockImplementation(
    (href) => `/app/#${href}`,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Copy node link" }),
  );
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  const link = new URL(writeText.mock.calls[0][0]);
  expect(link.pathname).toBe("/app/");
  const route = new URL(link.hash.slice(1), link.origin);
  expect(route.pathname).toBe("/editor-v2/pipeline/remote-id");
  expect(route.searchParams.get("nodeId")).toBe("Task with spaces");
});

it.each(["input", "output"] as const)(
  "finds the editable %s by its own entity list",
  async (nodeType) => {
    const root = navigation.rootSpec;
    if (!root) throw new Error("Missing root");
    navigation.navigateToSubgraph(root, root.tasks[0].$id);
    const spec = navigation.activeSpec;
    const node = nodeType === "input" ? spec?.inputs[0] : spec?.outputs[0];
    if (!node) throw new Error("Missing node");
    runInAction(() => {
      file.remote = {
        pipelineId: file.id,
        backendUrl: "https://backend.example.com",
      };
    });
    await open(
      <EditorNodeLinkButton entityId={node.$id} nodeType={nodeType} />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Copy node link" }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(
      new URL(writeText.mock.calls[0][0]).searchParams.get("nodeType"),
    ).toBe(nodeType);
  },
);

it.each(["saving", "dirty", "error"])(
  "waits for persisted node names (%s)",
  async (state) => {
    const task = navigation.rootSpec?.tasks[0];
    if (!task) throw new Error("Missing task");
    runInAction(() => {
      file.remote = {
        pipelineId: file.id,
        backendUrl: "https://backend.example.com",
      };
      autoSave.isSaving = state === "saving";
      autoSave.hasUnsavedChanges = state === "dirty";
      autoSave.error = state === "error" ? "Save failed" : null;
    });
    await open(<EditorNodeLinkButton entityId={task.$id} nodeType="task" />);
    const button = await screen.findByRole("button", {
      name: "Copy node link",
    });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(writeText).not.toHaveBeenCalled();
    act(() =>
      runInAction(() => {
        autoSave.isSaving = false;
        autoSave.hasUnsavedChanges = false;
        autoSave.error = null;
      }),
    );
    expect(button).toBeEnabled();
  },
);

it("keeps the copy action hidden in embedded editors, matching embedded view-only tabs", async () => {
  const task = navigation.rootSpec?.tasks[0];
  if (!task) throw new Error("Missing task");
  runInAction(() => {
    file.remote = {
      pipelineId: file.id,
      backendUrl: "https://backend.example.com",
    };
  });
  await open(
    <EditorNodeLinkButton entityId={task.$id} nodeType="task" />,
    "/",
    true,
  );
  expect(screen.queryByRole("button", { name: "Copy node link" })).toBeNull();
});
