import type { ComponentSpec } from "@/models/componentSpec";
import { serializeComponentSpecToText } from "@/models/componentSpec";

interface SpecStats {
  name: string;
  inputs: number;
  outputs: number;
  tasks: number;
  arguments: number;
  annotations: number;
  bindings: number;
  hasSpec: string;
  hasTasks: string;
}

const EMPTY_STATS: SpecStats = {
  name: "—",
  inputs: 0,
  outputs: 0,
  tasks: 0,
  arguments: 0,
  annotations: 0,
  bindings: 0,
  hasSpec: "No",
  hasTasks: "No",
};

function computeSpecCounts(spec: ComponentSpec): SpecStats {
  return {
    name: spec.name ?? "—",
    inputs: spec.inputs.length,
    outputs: spec.outputs.length,
    tasks: spec.tasks.length,
    arguments: spec.tasks.reduce((acc, t) => acc + t.arguments.length, 0),
    annotations: spec.tasks.reduce((acc, t) => acc + t.annotations.length, 0),
    bindings: spec.bindings.length,
    hasSpec: "Yes",
    hasTasks: spec.tasks.length > 0 ? "Yes" : "No",
  };
}

export function getSpecStats(spec: ComponentSpec | null): SpecStats {
  return spec ? computeSpecCounts(spec) : EMPTY_STATS;
}

export function getSpecYaml(spec: ComponentSpec | null): string {
  if (!spec) return "null";
  try {
    return serializeComponentSpecToText(spec);
  } catch {
    return "Error serializing spec";
  }
}

export function getSelectedInfo(
  selectedNodeId: string | null,
  selectedNodeType: string | null,
): string {
  return selectedNodeId ? `${selectedNodeType}: ${selectedNodeId}` : "None";
}
