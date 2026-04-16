import { deepClone } from "@/utils/deepClone";

import { Annotations, deserializeAnnotationValue } from "../annotations";
import { Binding } from "../entities/binding";
import type { ComponentSpec } from "../entities/componentSpec";
import { Task } from "../entities/task";
import { type Annotation, isGraphImplementation } from "../entities/types";
import type { IdGenerator } from "../factories/idGenerator";
import { YamlDeserializer } from "../serialization/yamlDeserializer";

interface UnpackSubgraphParams {
  spec: ComponentSpec;
  taskId: string;
  idGen: IdGenerator;
}

/**
 * Unpack a subgraph task by inlining its inner tasks and bindings into the
 * parent spec, rewiring external connections, and removing the subgraph task.
 * This is the inverse of `createSubgraph`.
 */
export function unpackSubgraph({
  spec,
  taskId,
  idGen,
}: UnpackSubgraphParams): boolean {
  const task = spec.tasks.find((t) => t.$id === taskId);
  if (!task) return false;

  const subgraphSpecJson = task.componentRef.spec;

  if (!isGraphImplementation(subgraphSpecJson?.implementation)) return false;

  // Deep-clone to strip MobX Keystone observable wrappers; the
  // YamlDeserializer expects plain JS objects for Object.entries() etc.
  const plainSpecJson = deepClone(subgraphSpecJson);

  const deserializer = new YamlDeserializer(idGen);
  const innerModel = deserializer.deserialize(plainSpecJson);

  const innerInputIds = new Set(innerModel.inputs.map((i) => i.$id));
  const innerOutputIds = new Set(innerModel.outputs.map((o) => o.$id));

  const incomingBindings = spec.bindings.filter(
    (b) => b.targetEntityId === taskId,
  );
  const outgoingBindings = spec.bindings.filter(
    (b) => b.sourceEntityId === taskId,
  );

  const boundInputPorts = new Set(
    incomingBindings.map((b) => b.targetPortName),
  );

  const taskIdMap = addInnerTasks(spec, innerModel, task, idGen);

  addInternalBindings(
    spec,
    innerModel,
    innerInputIds,
    innerOutputIds,
    taskIdMap,
    idGen,
  );
  rewireIncomingBindings(spec, innerModel, incomingBindings, taskIdMap, idGen);
  rewireOutgoingBindings(spec, innerModel, outgoingBindings, taskIdMap, idGen);
  transferStaticArguments(spec, innerModel, task, boundInputPorts, taskIdMap);

  spec.deleteTaskById(taskId);

  return true;
}

/**
 * Add each inner task to the parent spec with a fresh ID and deduplicated name.
 * Positions are rebased so the subgraph task's position becomes the center.
 * Returns a map from inner task ID to new task ID.
 */
function addInnerTasks(
  spec: ComponentSpec,
  innerModel: ComponentSpec,
  subgraphTask: Task,
  idGen: IdGenerator,
): Map<string, string> {
  const subgraphPosition = subgraphTask.annotations.get("editor.position");
  const centroid = computeCentroid(innerModel.tasks);
  const taskIdMap = new Map<string, string>();

  for (const innerTask of innerModel.tasks) {
    const newId = idGen.next("task");
    const newName = deduplicateTaskName(spec, innerTask.name, taskIdMap);

    const annotations = cloneAnnotations(innerTask.annotations);
    const innerPos = innerTask.annotations.get("editor.position");
    const rebasedPosition = {
      x: subgraphPosition.x + (innerPos.x - centroid.x),
      y: subgraphPosition.y + (innerPos.y - centroid.y),
    };

    const posIdx = annotations.findIndex((a) => a.key === "editor.position");
    if (posIdx >= 0) {
      annotations[posIdx] = { key: "editor.position", value: rebasedPosition };
    } else {
      annotations.push({ key: "editor.position", value: rebasedPosition });
    }

    const newTask = new Task({
      $id: newId,
      name: newName,
      componentRef: deepClone(innerTask.componentRef),
      isEnabled: innerTask.isEnabled
        ? deepClone(innerTask.isEnabled)
        : undefined,
      annotations: Annotations.from(annotations),
      arguments: innerTask.arguments.map((a) => deepClone(a)),
      executionOptions: innerTask.executionOptions
        ? deepClone(innerTask.executionOptions)
        : undefined,
    });

    taskIdMap.set(innerTask.$id, newId);
    spec.addTask(newTask);
  }

  return taskIdMap;
}

function computeCentroid(tasks: ComponentSpec["tasks"]): {
  x: number;
  y: number;
} {
  if (tasks.length === 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;
  for (const task of tasks) {
    const pos = task.annotations.get("editor.position");
    sumX += pos.x;
    sumY += pos.y;
  }
  return { x: sumX / tasks.length, y: sumY / tasks.length };
}

/** Add task-to-task bindings from the inner model, remapping entity IDs. */
function addInternalBindings(
  spec: ComponentSpec,
  innerModel: ComponentSpec,
  innerInputIds: Set<string>,
  innerOutputIds: Set<string>,
  taskIdMap: Map<string, string>,
  idGen: IdGenerator,
) {
  for (const binding of innerModel.bindings) {
    if (innerInputIds.has(binding.sourceEntityId)) continue;
    if (innerOutputIds.has(binding.targetEntityId)) continue;

    const newSource = taskIdMap.get(binding.sourceEntityId);
    const newTarget = taskIdMap.get(binding.targetEntityId);
    if (!newSource || !newTarget) continue;

    spec.addBinding(
      new Binding({
        $id: idGen.next("binding"),
        sourceEntityId: newSource,
        sourcePortName: binding.sourcePortName,
        targetEntityId: newTarget,
        targetPortName: binding.targetPortName,
      }),
    );
  }
}

/**
 * Rewire parent bindings that targeted the subgraph task's input ports.
 * Each parent binding is fanned out to all inner tasks that the corresponding
 * subgraph input was connected to.
 */
function rewireIncomingBindings(
  spec: ComponentSpec,
  innerModel: ComponentSpec,
  incomingBindings: Binding[],
  taskIdMap: Map<string, string>,
  idGen: IdGenerator,
) {
  for (const parentBinding of incomingBindings) {
    const subgraphInput = innerModel.inputs.find(
      (i) => i.name === parentBinding.targetPortName,
    );
    if (!subgraphInput) continue;

    const fromInputBindings = innerModel.bindings.filter(
      (b) => b.sourceEntityId === subgraphInput.$id,
    );

    for (const innerBinding of fromInputBindings) {
      const newTargetId = taskIdMap.get(innerBinding.targetEntityId);
      if (!newTargetId) continue;

      spec.addBinding(
        new Binding({
          $id: idGen.next("binding"),
          sourceEntityId: parentBinding.sourceEntityId,
          sourcePortName: parentBinding.sourcePortName,
          targetEntityId: newTargetId,
          targetPortName: innerBinding.targetPortName,
        }),
      );
    }
  }
}

/**
 * Rewire parent bindings that sourced from the subgraph task's output ports.
 * Each parent binding is reconnected from the inner task that fed the
 * corresponding subgraph output.
 */
function rewireOutgoingBindings(
  spec: ComponentSpec,
  innerModel: ComponentSpec,
  outgoingBindings: Binding[],
  taskIdMap: Map<string, string>,
  idGen: IdGenerator,
) {
  for (const parentBinding of outgoingBindings) {
    const subgraphOutput = innerModel.outputs.find(
      (o) => o.name === parentBinding.sourcePortName,
    );
    if (!subgraphOutput) continue;

    const toOutputBinding = innerModel.bindings.find(
      (b) => b.targetEntityId === subgraphOutput.$id,
    );
    if (!toOutputBinding) continue;

    const newSourceId = taskIdMap.get(toOutputBinding.sourceEntityId);
    if (!newSourceId) continue;

    spec.addBinding(
      new Binding({
        $id: idGen.next("binding"),
        sourceEntityId: newSourceId,
        sourcePortName: toOutputBinding.sourcePortName,
        targetEntityId: parentBinding.targetEntityId,
        targetPortName: parentBinding.targetPortName,
      }),
    );
  }
}

/**
 * For subgraph task arguments with static values (not covered by an incoming
 * binding), propagate the value to the inner tasks that the corresponding
 * subgraph input was connected to.
 */
function transferStaticArguments(
  spec: ComponentSpec,
  innerModel: ComponentSpec,
  subgraphTask: Task,
  boundInputPorts: Set<string>,
  taskIdMap: Map<string, string>,
) {
  for (const arg of subgraphTask.arguments) {
    if (arg.value === undefined) continue;
    if (boundInputPorts.has(arg.name)) continue;

    const subgraphInput = innerModel.inputs.find((i) => i.name === arg.name);
    if (!subgraphInput) continue;

    const fromInputBindings = innerModel.bindings.filter(
      (b) => b.sourceEntityId === subgraphInput.$id,
    );

    for (const innerBinding of fromInputBindings) {
      const newTaskId = taskIdMap.get(innerBinding.targetEntityId);
      if (!newTaskId) continue;

      const newTask = spec.tasks.find((t) => t.$id === newTaskId);
      if (!newTask) continue;

      newTask.setArgument(innerBinding.targetPortName, arg.value);
    }
  }
}

function cloneAnnotations(annotations: Annotations): Annotation[] {
  return annotations.items.map((a) => ({
    key: a.key,
    value: deserializeAnnotationValue(a.key, deepClone(a.value)),
  }));
}

/**
 * Generate a unique task name, accounting for both existing tasks in the spec
 * and tasks already queued for addition (tracked in taskIdMap via the names
 * we've already assigned).
 */
function deduplicateTaskName(
  spec: ComponentSpec,
  baseName: string,
  _taskIdMap: Map<string, string>,
): string {
  const existingNames = new Set(spec.tasks.map((t) => t.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter++;
  return `${baseName} ${counter}`;
}
