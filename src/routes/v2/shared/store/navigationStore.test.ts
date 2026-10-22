import { reaction } from "mobx";
import { undoMiddleware } from "mobx-keystone";
import { afterEach, expect, it } from "vitest";

import { ComponentSpec, Task } from "@/models/componentSpec";

import { EditorStore } from "./editorStore";
import { NavigationStore } from "./navigationStore";

const disposers: (() => void)[] = [];
afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));

function graph() {
  const leaf = new ComponentSpec({ name: "Leaf component" });
  const innerTask = new Task({
    name: "Inner task",
    componentRef: {},
    subgraphSpec: leaf,
  });
  const nested = new ComponentSpec({
    name: "Nested component",
    tasks: [innerTask],
  });
  const outerTask = new Task({
    name: "Outer task",
    componentRef: {},
    subgraphSpec: nested,
  });
  const root = new ComponentSpec({ name: "Root", tasks: [outerTask] });
  const editor = new EditorStore();
  const navigation = new NavigationStore(editor);
  navigation.initNavigation(root);
  navigation.navigateToSubgraph(root, outerTask.$id);
  navigation.navigateToSubgraph(nested, innerTask.$id);
  return { root, nested, leaf, outerTask, innerTask, editor, navigation };
}

it("keeps the active graph and parent identity when any path label changes", () => {
  const { root, nested, leaf, outerTask, innerTask, navigation } = graph();
  root.setName("Renamed root");
  root.renameTask(outerTask.$id, "Renamed outer");
  nested.renameTask(innerTask.$id, "Renamed inner");

  expect(navigation.activeSpec).toBe(leaf);
  expect(navigation.parentContext).toEqual({
    parentSpec: nested,
    taskId: innerTask.$id,
  });
  expect(navigation.navigationPath).toEqual([
    { specId: root.$id, displayName: "Renamed root" },
    { specId: nested.$id, displayName: "Renamed outer" },
    { specId: leaf.$id, displayName: "Renamed inner" },
  ]);
});

it("stays inside a renamed subgraph through undo and redo", () => {
  const { root, nested, leaf, innerTask, navigation } = graph();
  const undo = undoMiddleware(root);
  disposers.push(() => undo.dispose());

  expect(
    undo.withGroup("Rename subgraph", () =>
      navigation.renameCurrentSubgraph("Renamed subgraph"),
    ),
  ).toBe(true);
  expect(leaf.name).toBe("Renamed subgraph");
  expect(navigation.activeSpec).toBe(leaf);

  undo.undo();
  expect(navigation.activeSpec).toBe(leaf);
  expect(navigation.navigationPath.at(-1)?.displayName).toBe("Inner task");
  expect(leaf.name).toBe("Leaf component");

  undo.redo();
  expect(navigation.activeSpec).toBe(leaf);
  expect(navigation.navigationPath.at(-1)?.displayName).toBe(
    "Renamed subgraph",
  );
  expect(navigation.parentContext).toEqual({
    parentSpec: nested,
    taskId: innerTask.$id,
  });
});

it("recovers to the nearest surviving parent after undo removes the active task", () => {
  const { root, nested, leaf, innerTask, editor, navigation } = graph();
  navigation.navigateBack();
  nested.removeTaskById(innerTask.$id);
  const undo = undoMiddleware(root);
  disposers.push(() => undo.dispose());
  nested.addTask(innerTask);
  navigation.navigateToSubgraph(nested, innerTask.$id);
  editor.selectNode("selected-task", "task");
  disposers.push(
    reaction(
      () => ({
        active: navigation.activeSpec,
        depth: navigation.navigationDepth,
      }),
      ({ active, depth }) => {
        if (!active && depth > 0) navigation.correctInvalidNavigation();
      },
    ),
  );

  undo.undo();
  expect(navigation.activeSpec).toBe(nested);
  expect(navigation.navigationDepth).toBe(1);
  expect(navigation.navigationPath.map((entry) => entry.displayName)).toEqual([
    root.name,
    "Outer task",
  ]);
  expect(editor.selectedNodeId).toBeNull();
  expect(navigation.navigateBack()).toBe(root);
  expect(navigation.activeSpec).not.toBe(leaf);
});

it("resolves external name paths without storing names as identity", () => {
  const { root, nested, leaf, outerTask, navigation } = graph();
  navigation.navigateToLevel(0);
  expect(
    navigation.navigateToPath([root.name, "Outer task", "Inner task"]),
  ).toBe(leaf);
  expect(navigation.navigateToPath([root.name, "Missing task"])).toBeNull();
  expect(navigation.activeSpec).toBe(leaf);

  root.renameTask(outerTask.$id, "Updated outer task");
  expect(navigation.navigateToLevel(1)).toBe(nested);
  expect(navigation.navigationPath.at(-1)?.displayName).toBe(
    "Updated outer task",
  );
  navigation.clearNavigation();
  expect(navigation.navigationPath).toEqual([]);
  expect(navigation.activeSpec).toBeNull();
});
