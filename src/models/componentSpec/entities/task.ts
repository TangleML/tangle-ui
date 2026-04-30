import { computed } from "mobx";
import { idProp, Model, model, modelAction, prop } from "mobx-keystone";

import { Annotations } from "../annotations";
import type { ComponentSpec } from "./componentSpec";
import { createComponentSpecProxy } from "./componentSpecProxy";
import { deserializeSubgraphSpec } from "./taskSubgraphHelper";
import type {
  Argument,
  ArgumentType,
  ComponentReference,
  ComponentSpecJson,
  ExecutionOptionsSpec,
  PredicateType,
} from "./types";
import { isGraphImplementation } from "./types";

@model("spec/Task")
export class Task extends Model({
  $id: idProp,
  name: prop<string>(),
  componentRef: prop<ComponentReference>(),
  subgraphSpec: prop<ComponentSpec | undefined>(undefined),
  isEnabled: prop<PredicateType | undefined>(undefined),
  annotations: prop<Annotations>(() => new Annotations({})),
  arguments: prop<Argument[]>(() => []),
  executionOptions: prop<ExecutionOptionsSpec | undefined>(undefined),
}) {
  @modelAction
  setName(name: string) {
    this.name = name;
  }

  @modelAction
  setSubgraphSpec(spec: ComponentSpec | undefined) {
    this.subgraphSpec = spec;
  }

  /**
   * Guard: if the incoming ref has an inline graph spec, promote it to
   * `subgraphSpec` and strip it from `componentRef`. This ensures a graph
   * spec never stays as plain JSON at runtime.
   */
  @modelAction
  setComponentRef(ref: ComponentReference) {
    if (ref.spec && isGraphImplementation(ref.spec.implementation)) {
      this.subgraphSpec = deserializeSubgraphSpec(ref.spec);
      this.componentRef = { ...ref, spec: undefined };
    } else {
      this.subgraphSpec = undefined;
      this.componentRef = ref;
    }
  }

  @computed
  get resolvedComponentSpec(): ComponentSpecJson | undefined {
    if (this.subgraphSpec) {
      return createComponentSpecProxy(this.subgraphSpec);
    }
    return this.componentRef.spec;
  }

  @modelAction
  setIsEnabled(predicate: PredicateType | undefined) {
    this.isEnabled = predicate;
  }

  @modelAction
  addArgument(arg: Argument) {
    this.arguments.push(arg);
  }

  @modelAction
  setArgument(name: string, value: ArgumentType | undefined) {
    const idx = this.arguments.findIndex((a) => a.name === name);
    if (idx >= 0) {
      this.arguments[idx] = { name, value };
    } else {
      this.arguments.push({ name, value });
    }
  }

  @modelAction
  removeArgument(index: number) {
    this.arguments.splice(index, 1);
  }

  @modelAction
  removeArgumentByName(name: string) {
    const idx = this.arguments.findIndex((a) => a.name === name);
    if (idx >= 0) this.arguments.splice(idx, 1);
  }

  @modelAction
  clearArguments() {
    this.arguments.splice(0, this.arguments.length);
  }

  @modelAction
  setCacheStaleness(value: string | undefined) {
    if (value) {
      this.executionOptions = {
        ...this.executionOptions,
        cachingStrategy: { maxCacheStaleness: value },
      };
    } else {
      if (this.executionOptions) {
        const { cachingStrategy: _, ...rest } = this.executionOptions;
        this.executionOptions = Object.keys(rest).length > 0 ? rest : undefined;
      }
    }
  }
}
