import { action, computed, makeObservable, observable } from "mobx";

import type { ComponentSpec, ComponentSpecJson } from "@/models/componentSpec";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";

import { editorStore } from "./editorStore";

interface NavigationEntry {
  specId: string;
  displayName: string;
}

function isGraphSpecJson(specJson: ComponentSpecJson | undefined): boolean {
  if (!specJson?.implementation) return false;
  return "graph" in specJson.implementation;
}

class NavigationStore {
  rootSpec: ComponentSpec | null = null;
  nestedSpecs = new Map<string, ComponentSpec>();
  navigationPath: NavigationEntry[] = [];
  requestedPipelineName: string | null = null;
  private nestedIdGen = new IncrementingIdGenerator();

  constructor() {
    makeObservable(this, {
      rootSpec: observable.ref,
      nestedSpecs: observable.ref,
      navigationPath: observable.shallow,
      requestedPipelineName: observable,
      initNavigation: action,
      clearNavigation: action,
      navigateToSubgraph: action,
      navigateBack: action,
      navigateToLevel: action,
      navigateToPath: action,
      setRequestedPipelineName: action,
      activeSpec: computed,
      navigationDepth: computed,
      canNavigateBack: computed,
    });
  }

  setRequestedPipelineName(name: string | null) {
    this.requestedPipelineName = name;
  }

  initNavigation(rootSpec: ComponentSpec) {
    this.rootSpec = rootSpec;
    this.navigationPath = [
      { specId: rootSpec.$id, displayName: rootSpec.name },
    ];
    this.nestedSpecs = new Map();
    this.nestedIdGen = new IncrementingIdGenerator();
  }

  clearNavigation() {
    this.rootSpec = null;
    this.navigationPath = [];
    this.nestedSpecs = new Map();
  }

  isTaskSubgraph(spec: ComponentSpec, taskEntityId: string): boolean {
    const task = spec.tasks.find((t) => t.$id === taskEntityId);
    if (!task?.componentRef.spec) return false;
    return isGraphSpecJson(task.componentRef.spec);
  }

  navigateToSubgraph(
    currentSpec: ComponentSpec,
    taskEntityId: string,
  ): ComponentSpec | null {
    if (!this.rootSpec) return null;

    const task = currentSpec.tasks.find((t) => t.$id === taskEntityId);
    if (!task) return null;

    if (!task.componentRef.spec || !isGraphSpecJson(task.componentRef.spec)) {
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

    editorStore.clearSelection();
    return nestedSpec;
  }

  navigateBack(): ComponentSpec | null {
    if (!this.rootSpec || this.navigationPath.length <= 1) return null;

    this.navigationPath = this.navigationPath.slice(0, -1);
    editorStore.clearSelection();

    const newDepth = this.navigationPath.length - 1;
    return this.getSpecAtDepth(newDepth) ?? null;
  }

  navigateToLevel(index: number): ComponentSpec | null {
    if (!this.rootSpec || index < 0 || index >= this.navigationPath.length) {
      return null;
    }

    this.navigationPath = this.navigationPath.slice(0, index + 1);
    editorStore.clearSelection();
    return this.getSpecAtDepth(index) ?? null;
  }

  navigateToPath(pathNames: string[]): ComponentSpec | null {
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
    editorStore.clearSelection();
    return currentSpec;
  }

  get activeSpec(): ComponentSpec | null {
    if (this.navigationPath.length === 0) return null;
    return this.getSpecAtDepth(this.navigationPath.length - 1) ?? null;
  }

  get navigationDepth(): number {
    return this.navigationPath.length - 1;
  }

  get canNavigateBack(): boolean {
    return this.navigationPath.length > 1;
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

export const navigationStore = new NavigationStore();

export function initNavigation(rootSpec: ComponentSpec) {
  navigationStore.initNavigation(rootSpec);
}

export function clearNavigation() {
  navigationStore.clearNavigation();
}

export function isTaskSubgraph(
  spec: ComponentSpec,
  taskEntityId: string,
): boolean {
  return navigationStore.isTaskSubgraph(spec, taskEntityId);
}

export function navigateToSubgraph(
  currentSpec: ComponentSpec,
  taskEntityId: string,
): ComponentSpec | null {
  return navigationStore.navigateToSubgraph(currentSpec, taskEntityId);
}

export function navigateToLevel(index: number): ComponentSpec | null {
  return navigationStore.navigateToLevel(index);
}

export function navigateToPath(pathNames: string[]): ComponentSpec | null {
  return navigationStore.navigateToPath(pathNames);
}

export function setRequestedPipelineName(name: string | null) {
  navigationStore.setRequestedPipelineName(name);
}
