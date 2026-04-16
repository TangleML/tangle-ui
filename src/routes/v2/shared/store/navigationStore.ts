import { action, computed, makeObservable, observable } from "mobx";

import type { ComponentSpec, ComponentSpecJson } from "@/models/componentSpec";
import {
  IncrementingIdGenerator,
  serializeComponentSpec,
  YamlDeserializer,
} from "@/models/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";

import type { EditorStore } from "./editorStore";

interface NavigationEntry {
  specId: string;
  displayName: string;
}

export class NavigationStore {
  @observable.ref accessor rootSpec: ComponentSpec | null = null;
  @observable.ref accessor nestedSpecs = new Map<string, ComponentSpec>();
  @observable.shallow accessor navigationPath: NavigationEntry[] = [];
  @observable accessor requestedPipelineName: string | null = null;
  private nestedIdGen = new IncrementingIdGenerator();

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
    this.nestedSpecs = new Map();
    this.nestedIdGen = new IncrementingIdGenerator();
  }

  @action clearNavigation() {
    this.rootSpec = null;
    this.navigationPath = [];
    this.nestedSpecs = new Map();
  }

  isTaskSubgraph(spec: ComponentSpec, taskEntityId: string): boolean {
    const task = spec.tasks.find((t) => t.$id === taskEntityId);
    if (!task?.componentRef.spec) return false;
    return isGraphImplementation(task.componentRef.spec?.implementation);
  }

  @action navigateToSubgraph(
    currentSpec: ComponentSpec,
    taskEntityId: string,
  ): ComponentSpec | null {
    if (!this.rootSpec) return null;

    const task = currentSpec.tasks.find((t) => t.$id === taskEntityId);
    if (!task) return null;

    if (
      !task.componentRef.spec ||
      !isGraphImplementation(task.componentRef.spec?.implementation)
    ) {
      return null;
    }

    const pathKey =
      this.navigationPath.length > 1
        ? this.navigationPath
            .slice(1)
            .map((e) => e.displayName)
            .join("/") +
          "/" +
          task.name
        : task.name;

    let nestedSpec = this.nestedSpecs.get(pathKey);

    if (!nestedSpec) {
      // Deep-clone to detach from the keystone tree before deserializing
      const specJsonClone = JSON.parse(
        JSON.stringify(task.componentRef.spec),
      ) as ComponentSpecJson;
      nestedSpec = this.deserializeNestedSpec(specJsonClone, pathKey);
      if (!nestedSpec) return null;
    }

    this.navigationPath = [
      ...this.navigationPath,
      { specId: nestedSpec.$id, displayName: task.name },
    ];

    this.editorStore.clearSelection();
    return nestedSpec;
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
      if (!task?.componentRef.spec) return null;

      const pathKey = pathNames.slice(1, i + 1).join("/");
      let nestedSpec = this.nestedSpecs.get(pathKey);

      if (!nestedSpec) {
        const specJsonClone = JSON.parse(
          JSON.stringify(task.componentRef.spec),
        ) as ComponentSpecJson;
        nestedSpec = this.deserializeNestedSpec(specJsonClone, pathKey);
        if (!nestedSpec) return null;
      }

      newPath.push({ specId: nestedSpec.$id, displayName: taskName });
      currentSpec = nestedSpec;
    }

    this.navigationPath = newPath;
    this.editorStore.clearSelection();
    return currentSpec;
  }

  @computed get activeSpec(): ComponentSpec | null {
    if (this.navigationPath.length === 0) return null;
    return this.getSpecAtDepth(this.navigationPath.length - 1) ?? null;
  }

  @computed get navigationDepth(): number {
    return this.navigationPath.length - 1;
  }

  @computed get canNavigateBack(): boolean {
    return this.navigationPath.length > 1;
  }

  /**
   * Serialize each active nested spec and write it back into the parent
   * task's componentRef.spec so the root serialization includes subgraph edits.
   * Processes deepest-first so inner subgraphs sync before their parents.
   */
  @action syncNestedSpecs(): void {
    if (!this.rootSpec) return;

    const sortedPaths = [...this.nestedSpecs.keys()].sort(
      (a, b) => b.split("/").length - a.split("/").length,
    );

    for (const pathKey of sortedPaths) {
      const nestedSpec = this.nestedSpecs.get(pathKey);
      if (!nestedSpec) continue;

      const segments = pathKey.split("/");
      const taskName = segments[segments.length - 1];

      let parentSpec: ComponentSpec;
      if (segments.length === 1) {
        parentSpec = this.rootSpec;
      } else {
        const parentPathKey = segments.slice(0, -1).join("/");
        const found = this.nestedSpecs.get(parentPathKey);
        if (!found) continue;
        parentSpec = found;
      }

      const task = parentSpec.tasks.find((t) => t.name === taskName);
      if (!task) continue;

      const serialized = deepClone(serializeComponentSpec(nestedSpec));
      task.setComponentRef({ ...task.componentRef, spec: serialized });
    }
  }

  private getSpecAtDepth(depth: number): ComponentSpec | undefined {
    if (depth === 0) return this.rootSpec ?? undefined;
    const pathKey = this.navigationPath
      .slice(1, depth + 1)
      .map((e) => e.displayName)
      .join("/");
    return this.nestedSpecs.get(pathKey);
  }

  private deserializeNestedSpec(
    specJson: ComponentSpecJson,
    pathKey: string,
  ): ComponentSpec | undefined {
    try {
      const deserializer = new YamlDeserializer(this.nestedIdGen);
      const nestedSpec = deserializer.deserialize(specJson);
      const updated = new Map(this.nestedSpecs);
      updated.set(pathKey, nestedSpec);
      this.nestedSpecs = updated;
      return nestedSpec;
    } catch (error) {
      console.error("[deserializeNestedSpec] Failed to deserialize:", error);
      return undefined;
    }
  }
}
