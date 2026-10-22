import { action, computed, makeObservable, observable } from "mobx";

import type { ComponentSpec, Task } from "@/models/componentSpec";

import type { EditorStore } from "./editorStore";

export interface NavigationEntry {
  specId: string;
  displayName: string;
}

export interface ParentContext {
  parentSpec: ComponentSpec;
  taskId: string;
}

export class NavigationStore {
  @observable.ref accessor rootSpec: ComponentSpec | null = null;
  @observable.shallow private accessor taskPath: string[] = [];
  @observable accessor requestedPipelineName: string | null = null;

  constructor(private editorStore: EditorStore) {
    makeObservable(this);
  }

  @action setRequestedPipelineName(name: string | null) {
    this.requestedPipelineName = name;
  }

  @action initNavigation(rootSpec: ComponentSpec) {
    this.rootSpec = rootSpec;
    this.taskPath = [];
  }

  @action clearNavigation() {
    this.rootSpec = null;
    this.taskPath = [];
  }

  @action navigateToSubgraph(
    currentSpec: ComponentSpec,
    taskEntityId: string,
  ): ComponentSpec | null {
    if (!this.rootSpec) return null;

    const task = currentSpec.tasks.find((t) => t.$id === taskEntityId);
    if (!task?.subgraphSpec) return null;

    this.taskPath = [...this.taskPath, task.$id];

    this.editorStore.clearSelection();
    return task.subgraphSpec;
  }

  @action navigateBack(): ComponentSpec | null {
    if (!this.rootSpec || this.taskPath.length === 0) return null;

    this.taskPath = this.taskPath.slice(0, -1);
    this.editorStore.clearSelection();

    return this.activeSpec;
  }

  @action navigateToLevel(index: number): ComponentSpec | null {
    if (!this.rootSpec || index < 0 || index > this.taskPath.length) {
      return null;
    }

    this.taskPath = this.taskPath.slice(0, index);
    this.editorStore.clearSelection();
    return this.getSpecAtDepth(index) ?? null;
  }

  @action navigateToPath(pathNames: string[]): ComponentSpec | null {
    if (!this.rootSpec || pathNames.length === 0) return null;
    if (pathNames[0] !== this.rootSpec.name) return null;

    const taskPath: string[] = [];

    let currentSpec: ComponentSpec = this.rootSpec;

    for (let i = 1; i < pathNames.length; i++) {
      const taskName = pathNames[i];
      const task = currentSpec.tasks.find((t) => t.name === taskName);
      if (!task?.subgraphSpec) return null;

      taskPath.push(task.$id);
      currentSpec = task.subgraphSpec;
    }

    this.taskPath = taskPath;
    this.editorStore.clearSelection();
    return currentSpec;
  }

  @computed get navigationPath(): NavigationEntry[] {
    const rootSpec = this.rootSpec;
    if (!rootSpec) return [];
    let spec: ComponentSpec = rootSpec;

    const path = [{ specId: spec.$id, displayName: spec.name }];
    for (const taskId of this.taskPath) {
      const task: Task | undefined = spec.tasks.find(
        (task) => task.$id === taskId,
      );
      if (!task?.subgraphSpec) break;
      spec = task.subgraphSpec;
      path.push({ specId: spec.$id, displayName: task.name });
    }
    return path;
  }

  @computed get activeSpec(): ComponentSpec | null {
    return this.getSpecAtDepth(this.taskPath.length) ?? null;
  }

  /**
   * Resolves the parent spec and the task that owns the current subgraph.
   * Returns null when at the root level (no parent exists).
   */
  @computed get parentContext(): ParentContext | null {
    if (this.taskPath.length === 0) return null;
    const parentSpec = this.getSpecAtDepth(this.taskPath.length - 1);
    if (!parentSpec) return null;

    const taskId = this.taskPath.at(-1);
    const task = parentSpec.tasks.find((t) => t.$id === taskId);
    if (!task) return null;

    return { parentSpec, taskId: task.$id };
  }

  @computed get navigationDepth(): number {
    return this.rootSpec ? this.taskPath.length : -1;
  }

  @computed get canNavigateBack(): boolean {
    return this.taskPath.length > 0;
  }

  /**
   * Renames the subgraph at the current navigation depth (depth >= 1) by
   * renaming the owning task in the parent spec — the same operation a regular
   * task rename performs. Also updates the nested spec's name; navigation
   * continues to follow the task's stable identity.
   *
   * Returns false when at the root level, the name is empty or unchanged, the
   * owning task can't be found, or the rename collides with a sibling.
   */
  @action renameCurrentSubgraph(newName: string): boolean {
    const trimmed = newName.trim();
    if (!trimmed) return false;

    const depth = this.navigationDepth;
    if (depth === 0) return false;

    const parentSpec = this.getSpecAtDepth(depth - 1);
    if (!parentSpec) return false;

    const taskId = this.taskPath[depth - 1];
    const task = parentSpec.tasks.find((t) => t.$id === taskId);
    if (!task || task.name === trimmed) return false;

    const nestedSpec = this.getSpecAtDepth(depth);

    if (!parentSpec.renameTask(task.$id, trimmed)) return false;

    nestedSpec?.setName(trimmed);

    return true;
  }

  /**
   * Trims the task path to the deepest level that still resolves to a valid
   * spec. Handles cases where undo/redo removes a subgraph the user is viewing.
   */
  @action correctInvalidNavigation(): void {
    if (this.taskPath.length === 0) return;

    let deepestValid = 0;
    for (let i = 1; i <= this.taskPath.length; i++) {
      if (!this.getSpecAtDepth(i)) break;
      deepestValid = i;
    }

    if (deepestValid < this.taskPath.length) {
      this.taskPath = this.taskPath.slice(0, deepestValid);
      this.editorStore.clearSelection();
    }
  }

  private getSpecAtDepth(depth: number): ComponentSpec | undefined {
    if (depth === 0) return this.rootSpec ?? undefined;
    let current: ComponentSpec | undefined = this.rootSpec ?? undefined;
    for (let i = 1; i <= depth && current; i++) {
      const taskId = this.taskPath[i - 1];
      const task = current.tasks.find((t) => t.$id === taskId);
      current = task?.subgraphSpec;
    }
    return current;
  }
}
