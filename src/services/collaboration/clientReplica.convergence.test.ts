import { describe, expect, it } from "vitest";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Input } from "@/models/componentSpec/entities/input";
import type { Task } from "@/models/componentSpec/entities/task";
import type { ComponentReference } from "@/models/componentSpec/entities/types";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { createTaskFromComponentRef } from "@/models/componentSpec/factories/taskFactory";
import { IS_ENABLED_PORT_NAME } from "@/utils/conditionalExecution";

import { installActionCapture } from "./actionCapture";
import { ClientReplica } from "./clientReplica";
import type { BroadcastMessage, CollabSnapshot } from "./protocol";
import { applyCollabCommand } from "./serializedAction";
import {
  canonicalHash,
  fromCollabSnapshot,
  toCollabSnapshot,
} from "./snapshot";

const containerRef: ComponentReference = {
  name: "Train",
  spec: {
    name: "Train",
    inputs: [{ name: "path", type: "String", default: "/data" }],
    implementation: { container: { image: "train:1" } },
  },
};

function makeTask(name: string): Task {
  return createTaskFromComponentRef(
    new IncrementingIdGenerator(),
    containerRef,
    name,
  );
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyBase(): CollabSnapshot {
  return toCollabSnapshot(
    new ComponentSpec({ $id: "spec_root", name: "Pipeline" }),
  );
}

interface Client {
  readonly actorId: string;
  readonly root: ComponentSpec;
  readonly replica: ClientReplica;
  readonly inbox: BroadcastMessage[];
}

class ConvergenceSystem {
  readonly oracle: ComponentSpec;
  private version = 0;
  private readonly clients: Client[] = [];

  constructor(base: CollabSnapshot) {
    this.oracle = fromCollabSnapshot(base);
  }

  addClient(actorId: string, base: CollabSnapshot): Client {
    const root = fromCollabSnapshot(base);
    // Forward reference: the capture callback needs the replica, which in turn
    // needs this capture's `runBypassed`.
    // eslint-disable-next-line prefer-const
    let replica!: ClientReplica;
    const capture = installActionCapture(root, (captured) => {
      const message = replica.recordLocal(captured);
      this.version += 1;
      try {
        applyCollabCommand(this.oracle, message.command);
      } catch {
        // A throwing command is a no-op on every replica and on the oracle.
      }
      const broadcast: BroadcastMessage = {
        type: "broadcast",
        version: this.version,
        actorId,
        seq: message.seq,
        command: message.command,
      };
      for (const target of this.clients) target.inbox.push(broadcast);
    });
    replica = new ClientReplica(actorId, root, {
      runBypassed: capture.runBypassed,
    });
    const client: Client = { actorId, root, replica, inbox: [] };
    this.clients.push(client);
    return client;
  }

  deliver(client: Client, count: number): void {
    for (let i = 0; i < count && client.inbox.length > 0; i++) {
      const broadcast = client.inbox.shift();
      if (broadcast) client.replica.receive(broadcast);
    }
  }

  drain(): void {
    for (const client of this.clients) {
      while (client.inbox.length > 0) {
        this.deliver(client, client.inbox.length);
      }
    }
  }

  assertConverged(context: string): void {
    const oracleHash = canonicalHash(this.oracle);
    for (const client of this.clients) {
      expect(
        client.replica.pendingCount,
        `${context}: ${client.actorId} has undrained pending commands`,
      ).toBe(0);
      expect(
        canonicalHash(client.root),
        `${context}: ${client.actorId} diverged from the oracle`,
      ).toBe(oracleHash);
    }
  }
}

const NAMES = ["Alpha", "Beta", "Gamma"];
const PORTS = ["path", "model", "out", IS_ENABLED_PORT_NAME];
const VALUES = ["/one", "/two", "/three"];
const VERBS = [
  "addTask",
  "deleteTask",
  "renameTask",
  "setNodePosition",
  "setTaskArgument",
  "connectNodes",
  "deleteEdge",
] as const;

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function performRandomAction(root: ComponentSpec, rng: () => number): void {
  const tasks = root.tasks;
  const bindings = root.bindings;
  const taskId = (): string =>
    rng() < 0.85 && tasks.length > 0 ? pick(tasks, rng).$id : "task_ghost";

  switch (pick(VERBS, rng)) {
    case "addTask":
      root.addTask(makeTask(pick(NAMES, rng)));
      return;
    case "deleteTask":
      root.deleteTaskById(taskId());
      return;
    case "renameTask":
      root.renameTask(taskId(), pick(NAMES, rng));
      return;
    case "setNodePosition":
      root.updateNodePosition(taskId(), {
        x: Math.floor(rng() * 500),
        y: Math.floor(rng() * 500),
      });
      return;
    case "setTaskArgument":
      root.setTaskArgument(taskId(), pick(PORTS, rng), pick(VALUES, rng));
      return;
    case "connectNodes":
      if (tasks.length < 1) {
        root.addTask(makeTask(pick(NAMES, rng)));
        return;
      }
      root.connectNodes(
        { entityId: taskId(), portName: pick(PORTS, rng) },
        { entityId: taskId(), portName: pick(PORTS, rng) },
      );
      return;
    case "deleteEdge":
      root.deleteEdgeById(
        rng() < 0.85 && bindings.length > 0
          ? pick(bindings, rng).$id
          : "binding_ghost",
      );
      return;
  }
}

describe("ClientReplica convergence", () => {
  it("drains two local commands through their own echoes", () => {
    const base = emptyBase();
    const system = new ConvergenceSystem(base);
    const client = system.addClient("solo", base);

    client.root.addTask(makeTask("Alpha"));
    client.root.addTask(makeTask("Beta"));
    expect(client.replica.pendingCount).toBe(2);

    system.drain();
    system.assertConverged("solo drain");
    expect(client.root.tasks.map((t) => t.name)).toEqual(["Alpha", "Beta"]);
  });

  it("converges connectNodes racing setTaskArgument on the same port", () => {
    const seed = new ComponentSpec({ $id: "spec_root", name: "Pipeline" });
    seed.addTask(makeTask("Source"));
    seed.addTask(makeTask("Target"));
    const base = toCollabSnapshot(seed);
    const [sourceId, targetId] = seed.tasks.map((t) => t.$id);

    const system = new ConvergenceSystem(base);
    const a = system.addClient("A", base);
    const b = system.addClient("B", base);

    a.root.setTaskArgument(targetId, "path", "/literal");
    b.root.connectNodes(
      { entityId: sourceId, portName: "model" },
      { entityId: targetId, portName: "path" },
    );

    system.drain();
    system.assertConverged("connect vs argument");
  });

  it("converges when two actors rename to the same name", () => {
    const seed = new ComponentSpec({ $id: "spec_root", name: "Pipeline" });
    seed.addTask(makeTask("First"));
    seed.addTask(makeTask("Second"));
    const base = toCollabSnapshot(seed);
    const [firstId, secondId] = seed.tasks.map((t) => t.$id);

    const system = new ConvergenceSystem(base);
    const a = system.addClient("A", base);
    const b = system.addClient("B", base);

    a.root.renameTask(firstId, "Dup");
    b.root.renameTask(secondId, "Dup");

    system.drain();
    system.assertConverged("rename collision");
  });

  it("converges on an input added, connected, and edited across actors", () => {
    const seed = new ComponentSpec({ $id: "spec_root", name: "Pipeline" });
    seed.addTask(makeTask("Target"));
    const base = toCollabSnapshot(seed);
    const targetId = seed.tasks[0].$id;

    const system = new ConvergenceSystem(base);
    const a = system.addClient("A", base);
    const b = system.addClient("B", base);

    a.root.addInput(new Input({ $id: "input_shared", name: "data" }));
    system.drain();

    // Connect and edit race once every replica holds the shared input.
    a.root.connectNodes(
      { entityId: "input_shared", portName: "input_shared" },
      { entityId: targetId, portName: "path" },
    );
    b.root.inputs
      .find((i) => i.$id === "input_shared")
      ?.setDefaultValue("/edited");

    system.drain();
    system.assertConverged("io add + connect + edit");
    expect(a.root.inputs.map((i) => i.name)).toEqual(["data"]);
    expect(a.root.inputs[0].defaultValue).toBe("/edited");
    expect(a.root.bindings).toHaveLength(1);
  });

  it("converges when one actor edits a task the other just deleted", () => {
    const seed = new ComponentSpec({ $id: "spec_root", name: "Pipeline" });
    seed.addTask(makeTask("Victim"));
    const base = toCollabSnapshot(seed);
    const victimId = seed.tasks[0].$id;

    const system = new ConvergenceSystem(base);
    const a = system.addClient("A", base);
    const b = system.addClient("B", base);

    a.root.deleteTaskById(victimId);
    b.root.renameTask(victimId, "Renamed");

    system.drain();
    system.assertConverged("edit vs delete");
  });

  it("retargets a nested edit across a concurrent delete that shifts its index", () => {
    const seed = new ComponentSpec({ $id: "spec_root", name: "Pipeline" });
    seed.addInput(new Input({ $id: "input_0", name: "a" }));
    seed.addInput(new Input({ $id: "input_1", name: "b" }));
    seed.addInput(new Input({ $id: "input_2", name: "c" }));
    const base = toCollabSnapshot(seed);

    const system = new ConvergenceSystem(base);
    const a = system.addClient("A", base);
    const b = system.addClient("B", base);

    // B targets inputs[2]; A deletes inputs[0] first, shifting it to inputs[1].
    b.root.inputs.find((i) => i.$id === "input_2")?.setDescription("edited");
    a.root.deleteInputById("input_0");

    system.drain();
    system.assertConverged("index shift");
    expect(a.root.inputs.find((i) => i.$id === "input_2")?.description).toBe(
      "edited",
    );
  });

  it("routes a predicate action through the patch fallback", () => {
    const seed = new ComponentSpec({ $id: "spec_root", name: "Pipeline" });
    seed.addTask(makeTask("Source"));
    seed.addTask(makeTask("Target"));
    const base = toCollabSnapshot(seed);
    const [sourceId, targetId] = seed.tasks.map((t) => t.$id);

    const system = new ConvergenceSystem(base);
    const a = system.addClient("A", base);
    const b = system.addClient("B", base);

    a.root.connectNodes(
      { entityId: sourceId, portName: "out" },
      { entityId: targetId, portName: "path" },
    );
    system.drain();
    expect(a.root.bindings).toHaveLength(1);

    // Predicate arg cannot be serialized, so this ships as a patch command.
    a.root.removeAllBindingsBy((binding) => binding.targetPortName === "path");
    b.root.renameTask(targetId, "Renamed");

    system.drain();
    system.assertConverged("patch fallback");
    expect(a.root.bindings).toHaveLength(0);
  });

  const seedCount = Number(process.env.COLLAB_FUZZ_SEEDS ?? "200");
  it(
    `converges under ${seedCount} randomized interleavings`,
    { timeout: Math.max(10000, seedCount * 20) },
    () => {
      for (let seed = 1; seed <= seedCount; seed++) {
        const rng = mulberry32(seed);
        const base = emptyBase();
        const system = new ConvergenceSystem(base);
        const clients = [
          system.addClient("A", base),
          system.addClient("B", base),
        ];

        const rounds = 12 + Math.floor(rng() * 12);
        for (let round = 0; round < rounds; round++) {
          for (const client of clients) {
            if (rng() < 0.7) {
              const burst = 1 + Math.floor(rng() * 3);
              for (let k = 0; k < burst; k++) {
                performRandomAction(client.root, rng);
              }
            }
          }
          for (const client of clients) {
            const count = Math.floor(rng() * (client.inbox.length + 1));
            system.deliver(client, count);
          }
        }

        system.drain();
        system.assertConverged(`seed ${seed}`);
      }
    },
  );
});
