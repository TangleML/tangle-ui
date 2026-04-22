import { beforeEach, describe, expect, it } from "vitest";

import { createSubgraph } from "../../actions/createSubgraph";
import { unpackSubgraph } from "../../actions/unpackSubgraph";
import { Annotations } from "../../annotations";
import { Binding } from "../../entities/binding";
import { ComponentSpec } from "../../entities/componentSpec";
import { Input } from "../../entities/input";
import { Output } from "../../entities/output";
import { Task } from "../../entities/task";
import { IncrementingIdGenerator } from "../../factories/idGenerator";

function positionAnnotation(x: number, y: number): Annotations {
  return Annotations.from([{ key: "editor.position", value: { x, y } }]);
}

function makeTask(
  idGen: IncrementingIdGenerator,
  name: string,
  overrides: Partial<{
    componentRef: Record<string, unknown>;
    isEnabled: unknown;
    executionOptions: Record<string, unknown>;
    arguments: Array<{ name: string; value?: unknown }>;
    position: { x: number; y: number };
  }> = {},
): Task {
  const pos = overrides.position ?? { x: 0, y: 0 };
  const annotations = positionAnnotation(pos.x, pos.y);
  if (overrides.arguments) {
    const args = overrides.arguments as any[];
    return new Task({
      $id: idGen.next("task"),
      name,
      componentRef: overrides.componentRef ?? {},
      isEnabled: overrides.isEnabled as never,
      executionOptions: overrides.executionOptions as never,
      annotations,
      arguments: args,
    });
  }
  return new Task({
    $id: idGen.next("task"),
    name,
    componentRef: overrides.componentRef ?? {},
    isEnabled: overrides.isEnabled as never,
    executionOptions: overrides.executionOptions as never,
    annotations,
  });
}

function makeBinding(
  idGen: IncrementingIdGenerator,
  sourceEntityId: string,
  sourcePortName: string,
  targetEntityId: string,
  targetPortName: string,
): Binding {
  return new Binding({
    $id: idGen.next("binding"),
    sourceEntityId,
    sourcePortName,
    targetEntityId,
    targetPortName,
  });
}

interface BindingEdge {
  sourcePortName: string;
  targetPortName: string;
  sourceName: string;
  targetName: string;
}

function snapshotBindingEdges(spec: ComponentSpec): BindingEdge[] {
  const entityNameMap = new Map<string, string>();
  for (const t of spec.tasks) entityNameMap.set(t.$id, t.name);
  for (const i of spec.inputs) entityNameMap.set(i.$id, i.name);
  for (const o of spec.outputs) entityNameMap.set(o.$id, o.name);

  return spec.bindings
    .map((b) => ({
      sourcePortName: b.sourcePortName,
      targetPortName: b.targetPortName,
      sourceName: entityNameMap.get(b.sourceEntityId) ?? "UNKNOWN",
      targetName: entityNameMap.get(b.targetEntityId) ?? "UNKNOWN",
    }))
    .sort(
      (a, b) =>
        a.sourceName.localeCompare(b.sourceName) ||
        a.targetName.localeCompare(b.targetName) ||
        a.sourcePortName.localeCompare(b.sourcePortName),
    );
}

function allEntityIds(spec: ComponentSpec): Set<string> {
  const ids = new Set<string>();
  for (const t of spec.tasks) ids.add(t.$id);
  for (const i of spec.inputs) ids.add(i.$id);
  for (const o of spec.outputs) ids.add(o.$id);
  return ids;
}

function roundtrip(
  spec: ComponentSpec,
  selectedTaskIds: string[],
  idGen: IncrementingIdGenerator,
): boolean {
  const result = createSubgraph({
    spec,
    selectedTaskIds,
    subgraphName: "Subgraph",
    idGen,
  });
  if (!result) return false;

  return unpackSubgraph({
    spec,
    taskId: result.replacementTask.$id,
    idGen,
  });
}

describe("unpackSubgraph roundtrip", () => {
  let idGen: IncrementingIdGenerator;

  beforeEach(() => {
    idGen = new IncrementingIdGenerator();
  });

  it("single task roundtrip preserves task count and properties", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task = makeTask(idGen, "T1", {
      componentRef: { name: "MyComp" },
    });
    spec.addTask(task);

    const origTaskCount = spec.tasks.length;
    const origBindingCount = spec.bindings.length;

    expect(roundtrip(spec, [task.$id], idGen)).toBe(true);

    expect(spec.tasks.length).toBe(origTaskCount);
    expect(spec.bindings.length).toBe(origBindingCount);

    const restored = spec.tasks.find((t) => t.name === "T1");
    expect(restored).toBeDefined();
    expect(restored?.componentRef).toEqual({ name: "MyComp" });
  });

  it("two connected tasks roundtrip preserves binding connectivity", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const t1 = makeTask(idGen, "T1", { position: { x: 0, y: 0 } });
    const t2 = makeTask(idGen, "T2", { position: { x: 200, y: 0 } });
    spec.addTask(t1);
    spec.addTask(t2);
    spec.addBinding(makeBinding(idGen, t1.$id, "out", t2.$id, "in"));

    const origEdges = snapshotBindingEdges(spec);

    expect(roundtrip(spec, [t1.$id, t2.$id], idGen)).toBe(true);

    expect(spec.tasks.length).toBe(2);
    expect(spec.bindings.length).toBe(1);
    expect(snapshotBindingEdges(spec)).toEqual(origEdges);
  });

  it("external incoming binding preserved after roundtrip", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const input = new Input({ $id: idGen.next("input"), name: "data" });
    const t1 = makeTask(idGen, "T1");
    const t2 = makeTask(idGen, "T2", { position: { x: 200, y: 0 } });
    spec.addInput(input);
    spec.addTask(t1);
    spec.addTask(t2);
    spec.addBinding(makeBinding(idGen, input.$id, "data", t1.$id, "data"));
    spec.addBinding(makeBinding(idGen, t1.$id, "result", t2.$id, "input"));

    const origEdges = snapshotBindingEdges(spec);

    expect(roundtrip(spec, [t1.$id], idGen)).toBe(true);

    expect(spec.tasks.length).toBe(2);
    expect(spec.bindings.length).toBe(2);
    expect(snapshotBindingEdges(spec)).toEqual(origEdges);
  });

  it("external outgoing binding preserved after roundtrip", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const t1 = makeTask(idGen, "T1", { position: { x: 0, y: 0 } });
    const t2 = makeTask(idGen, "T2", { position: { x: 200, y: 0 } });
    const t3 = makeTask(idGen, "T3", { position: { x: 400, y: 0 } });
    spec.addTask(t1);
    spec.addTask(t2);
    spec.addTask(t3);
    spec.addBinding(makeBinding(idGen, t1.$id, "out", t2.$id, "in"));
    spec.addBinding(makeBinding(idGen, t2.$id, "out", t3.$id, "in"));

    const origEdges = snapshotBindingEdges(spec);

    expect(roundtrip(spec, [t2.$id], idGen)).toBe(true);

    expect(spec.tasks.length).toBe(3);
    expect(spec.bindings.length).toBe(2);
    expect(snapshotBindingEdges(spec)).toEqual(origEdges);
  });

  it("binding count preserved with complex graph (no ghost or extra bindings)", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const input = new Input({ $id: idGen.next("input"), name: "src" });
    const output = new Output({ $id: idGen.next("output"), name: "sink" });
    const t1 = makeTask(idGen, "T1", { position: { x: 0, y: 0 } });
    const t2 = makeTask(idGen, "T2", { position: { x: 200, y: 0 } });
    const t3 = makeTask(idGen, "T3", { position: { x: 200, y: 200 } });

    spec.addInput(input);
    spec.addOutput(output);
    spec.addTask(t1);
    spec.addTask(t2);
    spec.addTask(t3);

    spec.addBinding(makeBinding(idGen, input.$id, "src", t1.$id, "data"));
    spec.addBinding(makeBinding(idGen, t1.$id, "out", t2.$id, "in"));
    spec.addBinding(makeBinding(idGen, t2.$id, "result", output.$id, "sink"));
    spec.addBinding(makeBinding(idGen, t1.$id, "alt", t3.$id, "in"));

    const origEdges = snapshotBindingEdges(spec);

    expect(roundtrip(spec, [t1.$id, t2.$id], idGen)).toBe(true);

    expect(spec.tasks.length).toBe(3);
    expect(spec.bindings.length).toBe(4);
    expect(snapshotBindingEdges(spec)).toEqual(origEdges);
  });

  it("executionOptions with maxCacheStaleness preserved after roundtrip", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task = makeTask(idGen, "CachedTask", {
      componentRef: { name: "Comp" },
      executionOptions: {
        cachingStrategy: { maxCacheStaleness: "P1D" },
      },
    });
    spec.addTask(task);

    expect(roundtrip(spec, [task.$id], idGen)).toBe(true);

    const restored = spec.tasks.find((t) => t.name === "CachedTask");
    expect(restored).toBeDefined();
    expect(restored?.executionOptions).toEqual({
      cachingStrategy: { maxCacheStaleness: "P1D" },
    });
  });

  it("executionOptions with retryStrategy preserved after roundtrip", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task = makeTask(idGen, "RetryTask", {
      componentRef: { name: "Comp" },
      executionOptions: {
        retryStrategy: { maxRetries: 3 },
      },
    });
    spec.addTask(task);

    expect(roundtrip(spec, [task.$id], idGen)).toBe(true);

    const restored = spec.tasks.find((t) => t.name === "RetryTask");
    expect(restored).toBeDefined();
    expect(restored?.executionOptions).toEqual({
      retryStrategy: { maxRetries: 3 },
    });
  });

  it("executionOptions with both cachingStrategy and retryStrategy preserved", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task = makeTask(idGen, "FullOptionsTask", {
      executionOptions: {
        cachingStrategy: { maxCacheStaleness: "PT12H" },
        retryStrategy: { maxRetries: 5 },
      },
    });
    spec.addTask(task);

    expect(roundtrip(spec, [task.$id], idGen)).toBe(true);

    const restored = spec.tasks.find((t) => t.name === "FullOptionsTask");
    expect(restored?.executionOptions).toEqual({
      cachingStrategy: { maxCacheStaleness: "PT12H" },
      retryStrategy: { maxRetries: 5 },
    });
  });

  it("isEnabled predicate preserved after roundtrip", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const predicate = { "==": { op1: "a", op2: "b" } };
    const task = makeTask(idGen, "ConditionalTask", {
      isEnabled: predicate,
    });
    spec.addTask(task);

    expect(roundtrip(spec, [task.$id], idGen)).toBe(true);

    const restored = spec.tasks.find((t) => t.name === "ConditionalTask");
    expect(restored).toBeDefined();
    expect(restored?.isEnabled).toEqual(predicate);
  });

  it("static arguments preserved after roundtrip", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task = makeTask(idGen, "ArgTask", {
      arguments: [
        { name: "param", value: "hello" },
        { name: "count", value: 42 },
      ],
    });
    spec.addTask(task);

    expect(roundtrip(spec, [task.$id], idGen)).toBe(true);

    const restored = spec.tasks.find((t) => t.name === "ArgTask");
    expect(restored).toBeDefined();

    const paramArg = restored?.arguments.find((a) => a.name === "param");
    expect(paramArg?.value).toBe("hello");

    const countArg = restored?.arguments.find((a) => a.name === "count");
    expect(countArg?.value).toBe(42);
  });

  it("no ghost bindings after unpack (all binding endpoints reference real entities)", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const input = new Input({ $id: idGen.next("input"), name: "data" });
    const output = new Output({ $id: idGen.next("output"), name: "result" });
    const t1 = makeTask(idGen, "T1", { position: { x: 0, y: 0 } });
    const t2 = makeTask(idGen, "T2", { position: { x: 200, y: 0 } });

    spec.addInput(input);
    spec.addOutput(output);
    spec.addTask(t1);
    spec.addTask(t2);
    spec.addBinding(makeBinding(idGen, input.$id, "data", t1.$id, "data"));
    spec.addBinding(makeBinding(idGen, t1.$id, "out", t2.$id, "in"));
    spec.addBinding(makeBinding(idGen, t2.$id, "out", output.$id, "result"));

    expect(roundtrip(spec, [t1.$id, t2.$id], idGen)).toBe(true);

    const validIds = allEntityIds(spec);
    for (const binding of spec.bindings) {
      expect(
        validIds.has(binding.sourceEntityId),
        `binding source ${binding.sourceEntityId} should reference a real entity`,
      ).toBe(true);
      expect(
        validIds.has(binding.targetEntityId),
        `binding target ${binding.targetEntityId} should reference a real entity`,
      ).toBe(true);
    }
  });

  it("no duplicate bindings when different sources feed same-named ports on different selected tasks", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });

    const extA = makeTask(idGen, "ExtA", { position: { x: 0, y: 0 } });
    const extB = makeTask(idGen, "ExtB", { position: { x: 0, y: 200 } });
    const t1 = makeTask(idGen, "T1", { position: { x: 200, y: 0 } });
    const t2 = makeTask(idGen, "T2", { position: { x: 200, y: 200 } });
    const t3 = makeTask(idGen, "T3", { position: { x: 400, y: 100 } });

    spec.addTask(extA);
    spec.addTask(extB);
    spec.addTask(t1);
    spec.addTask(t2);
    spec.addTask(t3);

    spec.addBinding(
      makeBinding(idGen, extA.$id, "result", t1.$id, "trainer_name"),
    );
    spec.addBinding(
      makeBinding(idGen, extB.$id, "name", t2.$id, "trainer_name"),
    );
    spec.addBinding(makeBinding(idGen, t1.$id, "out", t3.$id, "in"));
    spec.addBinding(makeBinding(idGen, t2.$id, "out", t3.$id, "in2"));

    const origEdges = snapshotBindingEdges(spec);
    const origBindingCount = spec.bindings.length;

    expect(roundtrip(spec, [t1.$id, t2.$id], idGen)).toBe(true);

    expect(spec.bindings.length).toBe(origBindingCount);
    expect(snapshotBindingEdges(spec)).toEqual(origEdges);

    const validIds = allEntityIds(spec);
    for (const binding of spec.bindings) {
      expect(
        validIds.has(binding.sourceEntityId),
        `binding source ${binding.sourceEntityId} should reference a real entity`,
      ).toBe(true);
      expect(
        validIds.has(binding.targetEntityId),
        `binding target ${binding.targetEntityId} should reference a real entity`,
      ).toBe(true);
    }
  });
});
