import { getSnapshot } from "mobx-keystone";

import type { Task } from "@/models/componentSpec/entities/task";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";

import type { CollabCommand, CollabEndpoint } from "../protocol";
import { toCollabJsonObject } from "../snapshot";

export function addTaskCommand(task: Task): CollabCommand {
  return { type: "addTask", task: toCollabJsonObject(getSnapshot(task)) };
}

export function connectNodesCommand(
  source: CollabEndpoint,
  target: CollabEndpoint,
): CollabCommand {
  return {
    type: "connectNodes",
    bindingId: new IncrementingIdGenerator().next("binding"),
    source,
    target,
  };
}
