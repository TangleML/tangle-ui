import { computed } from "mobx";
import { idProp, Model, model, modelAction, prop } from "mobx-keystone";

import { Annotations } from "../annotations";
import type { ValidationIssue } from "../validation/types";
import { validateSpec } from "../validation/validateSpec";
import { Binding } from "./binding";
import type { Input } from "./input";
import type { Output } from "./output";
import type { Task } from "./task";
import type { ArgumentType, BindingEndpoint } from "./types";

@model("spec/ComponentSpec")
export class ComponentSpec extends Model({
  $id: idProp,
  name: prop<string>(),
  description: prop<string | undefined>(undefined),
  inputs: prop<Input[]>(() => []),
  outputs: prop<Output[]>(() => []),
  tasks: prop<Task[]>(() => []),
  bindings: prop<Binding[]>(() => []),
  annotations: prop<Annotations>(() => new Annotations({})),
}) {
  // --- Task mutations ---

  @modelAction
  addTask(task: Task) {
    this.tasks.push(task);
  }

  @modelAction
  removeTask(index: number) {
    return this.tasks.splice(index, 1)[0];
  }

  @modelAction
  removeTaskBy(predicate: (t: Task) => boolean): Task | undefined {
    const idx = this.tasks.findIndex(predicate);
    if (idx >= 0) return this.tasks.splice(idx, 1)[0];
    return undefined;
  }

  @modelAction
  removeTaskById(id: string): Task | undefined {
    return this.removeTaskBy((t) => t.$id === id);
  }

  // --- Input mutations ---

  @modelAction
  addInput(input: Input) {
    this.inputs.push(input);
  }

  @modelAction
  removeInput(index: number) {
    return this.inputs.splice(index, 1)[0];
  }

  @modelAction
  removeInputBy(predicate: (i: Input) => boolean): Input | undefined {
    const idx = this.inputs.findIndex(predicate);
    if (idx >= 0) return this.inputs.splice(idx, 1)[0];
    return undefined;
  }

  @modelAction
  removeInputById(id: string): Input | undefined {
    return this.removeInputBy((i) => i.$id === id);
  }

  // --- Output mutations ---

  @modelAction
  addOutput(output: Output) {
    this.outputs.push(output);
  }

  @modelAction
  removeOutput(index: number) {
    return this.outputs.splice(index, 1)[0];
  }

  @modelAction
  removeOutputBy(predicate: (o: Output) => boolean): Output | undefined {
    const idx = this.outputs.findIndex(predicate);
    if (idx >= 0) return this.outputs.splice(idx, 1)[0];
    return undefined;
  }

  @modelAction
  removeOutputById(id: string): Output | undefined {
    return this.removeOutputBy((o) => o.$id === id);
  }

  // --- Binding mutations ---

  @modelAction
  addBinding(binding: Binding) {
    this.bindings.push(binding);
  }

  @modelAction
  removeBinding(index: number) {
    return this.bindings.splice(index, 1)[0];
  }

  @modelAction
  removeBindingBy(predicate: (b: Binding) => boolean): Binding | undefined {
    const idx = this.bindings.findIndex(predicate);
    if (idx >= 0) return this.bindings.splice(idx, 1)[0];
    return undefined;
  }

  @modelAction
  removeBindingById(id: string): Binding | undefined {
    return this.removeBindingBy((b) => b.$id === id);
  }

  @modelAction
  removeAllBindingsBy(predicate: (b: Binding) => boolean): Binding[] {
    const removed: Binding[] = [];
    for (let i = this.bindings.length - 1; i >= 0; i--) {
      if (predicate(this.bindings[i])) {
        removed.push(this.bindings.splice(i, 1)[0]);
      }
    }
    return removed;
  }

  @modelAction
  connectNodes(source: BindingEndpoint, target: BindingEndpoint): Binding {
    this.removeAllBindingsBy(
      (b) =>
        b.targetEntityId === target.entityId &&
        b.targetPortName === target.portName,
    );
    const binding = new Binding({
      sourceEntityId: source.entityId,
      targetEntityId: target.entityId,
      sourcePortName: source.portName,
      targetPortName: target.portName,
    });
    this.bindings.push(binding);

    const task = this.tasks.find((t) => t.$id === target.entityId);
    if (task) {
      task.removeArgumentByName(target.portName);
    }

    return binding;
  }

  // --- Metadata helpers ---

  getMetadata(key: string): unknown {
    return this.annotations.get(`metadata.${key}`);
  }

  @modelAction
  setMetadata(key: string, value: unknown) {
    this.annotations.set(`metadata.${key}`, value);
  }

  // --- Compound mutations (used by editor actions) ---

  @modelAction
  deleteTaskById(entityId: string): boolean {
    const idx = this.tasks.findIndex((t) => t.$id === entityId);
    if (idx < 0) return false;
    this.removeAllBindingsBy(
      (b) => b.sourceEntityId === entityId || b.targetEntityId === entityId,
    );
    this.tasks.splice(idx, 1);
    return true;
  }

  @modelAction
  deleteInputById(entityId: string): boolean {
    const idx = this.inputs.findIndex((i) => i.$id === entityId);
    if (idx < 0) return false;
    this.removeAllBindingsBy((b) => b.sourceEntityId === entityId);
    this.inputs.splice(idx, 1);
    return true;
  }

  @modelAction
  deleteOutputById(entityId: string): boolean {
    const idx = this.outputs.findIndex((o) => o.$id === entityId);
    if (idx < 0) return false;
    this.removeAllBindingsBy((b) => b.targetEntityId === entityId);
    this.outputs.splice(idx, 1);
    return true;
  }

  @modelAction
  deleteEdgeById(bindingId: string): boolean {
    const idx = this.bindings.findIndex((b) => b.$id === bindingId);
    if (idx < 0) return false;
    this.bindings.splice(idx, 1);
    return true;
  }

  @modelAction
  setTaskArgument(taskId: string, portName: string, value: ArgumentType): void {
    const task = this.tasks.find((t) => t.$id === taskId);
    if (!task) return;

    this.removeAllBindingsBy(
      (b) => b.targetEntityId === taskId && b.targetPortName === portName,
    );

    task.setArgument(portName, value);
  }

  @modelAction
  renameTask(entityId: string, newName: string): boolean {
    const task = this.tasks.find((t) => t.$id === entityId);
    if (!task) return false;
    if (this.tasks.some((t) => t.name === newName && t.$id !== entityId))
      return false;
    task.name = newName;
    return true;
  }

  @modelAction
  renameInput(entityId: string, newName: string): boolean {
    const input = this.inputs.find((i) => i.$id === entityId);
    if (!input) return false;
    if (this.inputs.some((i) => i.name === newName && i.$id !== entityId))
      return false;
    input.name = newName;
    return true;
  }

  @modelAction
  renameOutput(entityId: string, newName: string): boolean {
    const output = this.outputs.find((o) => o.$id === entityId);
    if (!output) return false;
    if (this.outputs.some((o) => o.name === newName && o.$id !== entityId))
      return false;
    output.name = newName;
    return true;
  }

  @modelAction
  updateNodePosition(entityId: string, position: { x: number; y: number }) {
    const entity =
      this.tasks.find((t) => t.$id === entityId) ??
      this.inputs.find((i) => i.$id === entityId) ??
      this.outputs.find((o) => o.$id === entityId);
    if (!entity) return;
    entity.annotations.set("editor.position", position);
  }

  // --- Property setters ---

  @modelAction
  setName(name: string) {
    this.name = name;
  }

  @modelAction
  setDescription(description: string | undefined) {
    this.description = description;
  }

  // --- Computed helpers ---

  @computed
  get taskCount(): number {
    return this.tasks.length;
  }

  @computed
  get inputCount(): number {
    return this.inputs.length;
  }

  @computed
  get outputCount(): number {
    return this.outputs.length;
  }

  @computed
  get bindingCount(): number {
    return this.bindings.length;
  }

  // --- Validation ---

  @computed
  get validationIssues(): ValidationIssue[] {
    return validateSpec(this);
  }

  @computed
  get isValid(): boolean {
    return this.validationIssues.length === 0;
  }

  @computed
  get issuesByEntityId(): Map<string, ValidationIssue[]> {
    const map = new Map<string, ValidationIssue[]>();
    for (const issue of this.validationIssues) {
      if (!issue.entityId) continue;
      const existing = map.get(issue.entityId);
      if (existing) {
        existing.push(issue);
      } else {
        map.set(issue.entityId, [issue]);
      }
    }
    return map;
  }

  @computed
  get graphLevelIssues(): ValidationIssue[] {
    return this.validationIssues.filter((i) => !i.entityId);
  }
}
