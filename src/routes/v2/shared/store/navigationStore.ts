import { action, computed, makeObservable, observable } from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";

import type { EditorStore } from "./editorStore";

interface NavigationEntry {
  specId: string;
  displayName: string;
}

export interface ParentContext {
  parentSpec: ComponentSpec;
  taskId: string;
}

export class NavigationStore {
  @observable.ref accessor rootSpec: ComponentSpec | null = null;
  @observable.shallow accessor navigationPath: NavigationEntry[] = [];
  @observable accessor requestedPipelineName: string | null = null;

  constructor(private editorStore: EditorStore) {
    makeObservable(this);
  }

  @action setRequestedPipelineName(name: string | null) {
    this.requestedPipelineName = name;
  }

  @action initNavigation(rootSpec: ComponentSpec) {
    this.rootSpec = rootSpec;
    this.navigationPath = [
      { specId: rootSpec.$id, displayName: rootSpec.name },
    ];
  }

  @action clearNavigation() {
    this.rootSpec = null;
    this.navigationPath = [];
  }

  isTaskSubgraph(_spec: ComponentSpec, taskEntityId: string): boolean {
    const active = this.activeSpec;
    if (!active) return false;
    const task = active.tasks.find((t) => t.$id === taskEntityId);
    return task?.subgraphSpec !== undefined;
  }

  @action navigateToSubgraph(
    currentSpec: ComponentSpec,
    taskEntityId: string,
  ): ComponentSpec | null {
    if (!this.rootSpec) return null;

    const task = currentSpec.tasks.find((t) => t.$id === taskEntityId);
    if (!task?.subgraphSpec) return null;

    this.navigationPath = [
      ...this.navigationPath,
      { specId: task.subgraphSpec.$id, displayName: task.name },
    ];

    this.editorStore.clearSelection();
    return task.subgraphSpec;
  }

  @action navigateBack(): ComponentSpec | null {
    if (!this.rootSpec || this.navigationPath.length <= 1) return null;

    this.navigationPath = this.navigationPath.slice(0, -1);
    this.editorStore.clearSelection();

    const newDepth = this.navigationPath.length - 1;
    return this.getSpecAtDepth(newDepth) ?? null;
  }

  @action navigateToLevel(index: number): ComponentSpec | null {
    if (!this.rootSpec || index < 0 || index >= this.navigationPath.length) {
      return null;
    }

    this.navigationPath = this.navigationPath.slice(0, index + 1);
    this.editorStore.clearSelection();
    return this.getSpecAtDepth(index) ?? null;
  }

  @action navigateToPath(pathNames: string[]): ComponentSpec | null {
    if (!this.rootSpec || pathNames.length === 0) return null;
    if (pathNames[0] !== this.rootSpec.name) return null;

    const newPath: NavigationEntry[] = [
      { specId: this.rootSpec.$id, displayName: this.rootSpec.name },
    ];

    let currentSpec: ComponentSpec = this.rootSpec;

    for (let i = 1; i < pathNames.length; i++) {
      const taskName = pathNames[i];
      const task = currentSpec.tasks.find((t) => t.name === taskName);
      if (!task?.subgraphSpec) return null;

      newPath.push({
        specId: task.subgraphSpec.$id,
        displayName: taskName,
      });
      currentSpec = task.subgraphSpec;
    }

    this.navigationPath = newPath;
    this.editorStore.clearSelection();
    return currentSpec;
  }

  @computed get activeSpec(): ComponentSpec | null {
    if (this.navigationPath.length === 0) return null;
    return this.getSpecAtDepth(this.navigationPath.length - 1) ?? null;
  }

  /**
   * Resolves the parent spec and the task that owns the current subgraph.
   * Returns null when at the root level (no parent exists).
   */
  @computed get parentContext(): ParentContext | null {
    if (this.navigationPath.length <= 1) return null;
    const parentSpec = this.getSpecAtDepth(this.navigationPath.length - 2);
    if (!parentSpec) return null;

    const taskName =
      this.navigationPath[this.navigationPath.length - 1].displayName;
    const task = parentSpec.tasks.find((t) => t.name === taskName);
    if (!task) return null;

    return { parentSpec, taskId: task.$id };
  }

  @computed get navigationDepth(): number {
    return this.navigationPath.length - 1;
  }

  @computed get canNavigateBack(): boolean {
    return this.navigationPath.length > 1;
  }

  /**
   * Trims navigationPath to the deepest level that still resolves to a valid
   * spec. Handles cases where undo/redo removes a subgraph the user is viewing.
   */
  @action correctInvalidNavigation(): void {
    if (this.navigationPath.length <= 1) return;

    let deepestValid = 0;
    for (let i = 1; i < this.navigationPath.length; i++) {
      if (!this.getSpecAtDepth(i)) break;
      deepestValid = i;
    }

    if (deepestValid < this.navigationPath.length - 1) {
      this.navigationPath = this.navigationPath.slice(0, deepestValid + 1);
      this.editorStore.clearSelection();
    }
  }

  private getSpecAtDepth(depth: number): ComponentSpec | undefined {
    if (depth === 0) return this.rootSpec ?? undefined;
    let current: ComponentSpec | undefined = this.rootSpec ?? undefined;
    for (let i = 1; i <= depth && current; i++) {
      const taskName = this.navigationPath[i]?.displayName;
      const task = current.tasks.find((t) => t.name === taskName);
      current = task?.subgraphSpec;
    }
    return current;
  }
}
