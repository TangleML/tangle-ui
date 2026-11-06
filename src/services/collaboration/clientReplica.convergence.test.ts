import { describe, expect, it } from "vitest";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import type { ComponentReference } from "@/models/componentSpec/entities/types";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { createTaskFromComponentRef } from "@/models/componentSpec/factories/taskFactory";
import { IS_ENABLED_PORT_NAME } from "@/utils/conditionalExecution";

import { ClientReplica } from "./clientReplica";
import { applyCommand } from "./commands/applyCommand";
import { addTaskCommand, connectNodesCommand } from "./commands/createCommands";
import type {
  BroadcastMessage,
  CollabCommand,
  CollabSnapshot,
} from "./protocol";
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
  replica: ClientReplica;
  root: ComponentSpec;
  inbox: BroadcastMessage[];
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
    const client: Client = {
      replica: new ClientReplica(actorId, root),
      root,
      inbox: [],
    };
    this.clients.push(client);
    return client;
  }

  submitLocal(client: Client, command: CollabCommand): void {
    const message = client.replica.applyLocal(command);
    if (!message) return;
    this.version += 1;
    try {
      applyCommand(this.oracle, command);
    } catch {
      // A throwing command is a no-op on every replica and on the oracle.
    }
    const broadcast: BroadcastMessage = {
      type: "broadcast",
      version: this.version,
      actorId: client.replica.actorId,
      seq: message.seq,
      command,
    };
    for (const target of this.clients) {
      target.inbox.push(broadcast);
    }
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
        `${context}: ${client.replica.actorId} has undrained pending commands`,
      ).toBe(0);
      expect(
        canonicalHash(client.root),
        `${context}: ${client.replica.actorId} diverged from the oracle`,
      ).toBe(oracleHash);
    }
  }
}

function makeTaskCommand(name: string): CollabCommand {
  const task = createTaskFromComponentRef(
    new IncrementingIdGenerator(),
    containerRef,
    name,
  );
  return addTaskCommand(task);
}

const NAMES = ["Alpha", "Beta", "Gamma"];
const PORTS = ["path", "model", "out", IS_ENABLED_PORT_NAME];
const VALUES = ["/one", "/two", "/three"];
const VERBS = [
  "addTask",
  "deleteTask",
  "renameTask",
  "setTaskPosition",
  "setTaskArgument",
  "connectNodes",
  "deleteEdge",
] as const;

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function generateCommand(
  root: ComponentSpec,
  rng: () => number,
): CollabCommand | null {
  const tasks = root.tasks;
  const bindings = root.bindings;
  const taskId = (): string =>
    rng() < 0.85 && tasks.length > 0 ? pick(tasks, rng).$id : "task_ghost";

  switch (pick(VERBS, rng)) {
    case "addTask":
      return makeTaskCommand(pick(NAMES, rng));
    case "deleteTask":
      return { type: "deleteTask", taskId: taskId() };
    case "renameTask":
      return { type: "renameTask", taskId: taskId(), name: pick(NAMES, rng) };
    case "setTaskPosition":
      return {
        type: "setTaskPosition",
        taskId: taskId(),
        position: { x: Math.floor(rng() * 500), y: Math.floor(rng() * 500) },
      };
    case "setTaskArgument":
      return {
        type: "setTaskArgument",
        taskId: taskId(),
        portName: pick(PORTS, rng),
        value: pick(VALUES, rng),
      };
    case "connectNodes": {
      if (tasks.length < 1) return makeTaskCommand(pick(NAMES, rng));
      return connectNodesCommand(
        { entityId: taskId(), portName: pick(PORTS, rng) },
        { entityId: taskId(), portName: pick(PORTS, rng) },
      );
    }
    case "deleteEdge":
      return {
        type: "deleteEdge",
        bindingId:
          rng() < 0.85 && bindings.length > 0
            ? pick(bindings, rng).$id
            : "binding_ghost",
      };
  }
}

describe("ClientReplica convergence", () => {
  it("drains two local commands through their own echoes", () => {
    const base = emptyBase();
    const system = new ConvergenceSystem(base);
    const client = system.addClient("solo", base);

    system.submitLocal(client, makeTaskCommand("Alpha"));
    system.submitLocal(client, makeTaskCommand("Beta"));
    expect(client.replica.pendingCount).toBe(2);

    system.drain();
    system.assertConverged("solo drain");
    expect(client.root.tasks.map((t) => t.name)).toEqual(["Alpha", "Beta"]);
  });

  it("converges connectNodes racing setTaskArgument on the same port", () => {
    const seed = new ComponentSpec({ $id: "spec_root", name: "Pipeline" });
    applyCommand(seed, makeTaskCommand("Source"));
    applyCommand(seed, makeTaskCommand("Target"));
    const base = toCollabSnapshot(seed);
    const [sourceId, targetId] = seed.tasks.map((t) => t.$id);

    const system = new ConvergenceSystem(base);
    const a = system.addClient("A", base);
    const b = system.addClient("B", base);

    system.submitLocal(a, {
      type: "setTaskArgument",
      taskId: targetId,
      portName: "path",
      value: "/literal",
    });
    system.submitLocal(b, {
      type: "connectNodes",
      bindingId: "binding_race",
      source: { entityId: sourceId, portName: "model" },
      target: { entityId: targetId, portName: "path" },
    });

    system.drain();
    system.assertConverged("connect vs argument");
  });

  it("converges when two actors rename to the same name", () => {
    const seed = new ComponentSpec({ $id: "spec_root", name: "Pipeline" });
    applyCommand(seed, makeTaskCommand("First"));
    applyCommand(seed, makeTaskCommand("Second"));
    const base = toCollabSnapshot(seed);
    const [firstId, secondId] = seed.tasks.map((t) => t.$id);

    const system = new ConvergenceSystem(base);
    const a = system.addClient("A", base);
    const b = system.addClient("B", base);

    system.submitLocal(a, { type: "renameTask", taskId: firstId, name: "Dup" });
    system.submitLocal(b, {
      type: "renameTask",
      taskId: secondId,
      name: "Dup",
    });

    system.drain();
    system.assertConverged("rename collision");
  });

  it("converges when one actor edits a task the other just deleted", () => {
    const seed = new ComponentSpec({ $id: "spec_root", name: "Pipeline" });
    applyCommand(seed, makeTaskCommand("Victim"));
    const base = toCollabSnapshot(seed);
    const victimId = seed.tasks[0].$id;

    const system = new ConvergenceSystem(base);
    const a = system.addClient("A", base);
    const b = system.addClient("B", base);

    system.submitLocal(a, { type: "deleteTask", taskId: victimId });
    system.submitLocal(b, {
      type: "renameTask",
      taskId: victimId,
      name: "Renamed",
    });

    system.drain();
    system.assertConverged("edit vs delete");
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
                const command = generateCommand(client.root, rng);
                if (command) system.submitLocal(client, command);
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
