import type {
  ComponentSpec,
  ComponentSpecJson,
  Task,
  TypeSpecType,
} from "@/models/componentSpec";

import type { SelectedNode } from "../../../../store/editorStore";

export interface AggregatedArgument {
  name: string;
  type?: TypeSpecType;
  typeLabel: string;
  optional: boolean;
  defaultValue?: string;
  /** The shared value across all tasks, or empty string when mixed. */
  value: string;
  isMixed: boolean;
  /** Task IDs that have this input in their component spec. */
  taskIds: string[];
}

function typeSpecToString(typeSpec?: TypeSpecType): string {
  if (typeSpec === undefined) return "";
  if (typeof typeSpec === "string") return typeSpec;
  return JSON.stringify(typeSpec);
}

/**
 * Aggregate arguments across selected tasks. Two inputs match when they share
 * the same name and serialized type. Only arguments present in 2+ tasks are returned.
 */
export function computeAggregatedArguments(
  tasks: Task[],
): AggregatedArgument[] {
  const map = new Map<
    string,
    {
      name: string;
      type?: TypeSpecType;
      typeLabel: string;
      optional: boolean;
      defaultValue?: string;
      values: Array<string | undefined>;
      taskIds: string[];
    }
  >();

  for (const task of tasks) {
    const componentSpec = task.componentRef.spec as
      | ComponentSpecJson
      | undefined;
    const inputs = componentSpec?.inputs ?? [];

    for (const inputSpec of inputs) {
      const key = `${inputSpec.name}::${JSON.stringify(inputSpec.type)}`;
      const arg = task.arguments.find((a) => a.name === inputSpec.name);
      const effectiveValue =
        arg !== undefined && typeof arg.value === "string"
          ? arg.value
          : undefined;

      const existing = map.get(key);
      if (existing) {
        existing.values.push(effectiveValue);
        existing.taskIds.push(task.$id);
        if (!inputSpec.optional) existing.optional = false;
      } else {
        map.set(key, {
          name: inputSpec.name,
          type: inputSpec.type,
          typeLabel: typeSpecToString(inputSpec.type),
          optional: inputSpec.optional ?? true,
          defaultValue: inputSpec.default,
          values: [effectiveValue],
          taskIds: [task.$id],
        });
      }
    }
  }

  const result: AggregatedArgument[] = [];
  for (const entry of map.values()) {
    if (entry.taskIds.length < 2) continue;

    const firstValue = entry.values[0];
    const allSame = entry.values.every((v) => v === firstValue);

    result.push({
      name: entry.name,
      type: entry.type,
      typeLabel: entry.typeLabel,
      optional: entry.optional,
      defaultValue: entry.defaultValue,
      value: allSame && firstValue !== undefined ? firstValue : "",
      isMixed: !allSame,
      taskIds: entry.taskIds,
    });
  }

  return result;
}

export function getNodeDisplayName(
  node: SelectedNode,
  spec: ComponentSpec | null,
): string {
  if (!spec) return node.id;

  switch (node.type) {
    case "task": {
      const task = spec.tasks.find((t) => t.$id === node.id);
      return task?.name ?? node.id;
    }
    case "input": {
      const input = spec.inputs.find((i) => i.$id === node.id);
      return input?.name ?? node.id;
    }
    case "output": {
      const output = spec.outputs.find((o) => o.$id === node.id);
      return output?.name ?? node.id;
    }
    default:
      return node.id;
  }
}

export function getNodeIcon(type: SelectedNode["type"]): string {
  switch (type) {
    case "task":
      return "Workflow";
    case "input":
      return "Download";
    case "output":
      return "Upload";
  }
}

export function getNodeIconColor(type: SelectedNode["type"]): string {
  switch (type) {
    case "task":
      return "text-blue-500";
    case "input":
      return "text-blue-500";
    case "output":
      return "text-green-500";
  }
}
