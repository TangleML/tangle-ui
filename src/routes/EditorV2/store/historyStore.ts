/**
 * History Store - tracks spec changes for audit trail display.
 *
 * Uses Valtio's subscribe API to capture operations and display
 * a human-readable history of changes. Undo functionality is not
 * available in this version.
 */

import { proxy } from "valtio";

/**
 * Valtio operation format from subscribe callback.
 * Format: [operationType, path, value, previousValue]
 */
type ValtioOperation = [
  op: "set" | "delete" | "resolve" | "reject",
  path: (string | number | symbol)[],
  value?: unknown,
  previousValue?: unknown,
];

/**
 * Single history entry representing a spec change.
 */
export interface HistoryEntry {
  /** Unique ID for this entry */
  id: string;
  /** Unix timestamp when the change occurred */
  timestamp: number;
  /** Human-readable description of the change */
  description: string;
}

interface HistoryStore {
  /** Ordered list of history entries (oldest first) */
  entries: HistoryEntry[];
  /** Whether history tracking is enabled */
  isEnabled: boolean;
}

export const historyStore = proxy<HistoryStore>({
  entries: [],
  isEnabled: true,
});

/** Maximum number of history entries to keep */
const MAX_HISTORY_ENTRIES = 100;

/** Generate a unique history entry ID */
function generateHistoryId(): string {
  return `history-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Position annotation key */
const EDITOR_POSITION_ANNOTATION = "editor.position";

/**
 * Categorized operations for formatting.
 */
interface CategorizedOps {
  taskAdd: ValtioOperation[];
  taskRemove: ValtioOperation[];
  bindingAdd: ValtioOperation[];
  bindingRemove: ValtioOperation[];
  inputAdd: ValtioOperation[];
  inputRemove: ValtioOperation[];
  outputAdd: ValtioOperation[];
  outputRemove: ValtioOperation[];
  nameChange: ValtioOperation[];
  positionChange: ValtioOperation[];
  annotationChange: ValtioOperation[];
  argumentChange: ValtioOperation[];
}

/**
 * Extract entity name from a value object.
 */
function extractName(value: unknown): string | null {
  if (value && typeof value === "object" && "name" in value) {
    return (value as { name: string }).name;
  }
  return null;
}

/**
 * Extract a readable name from an entity ID.
 * Entity IDs look like "root.SpecName.tasks_1" or "root.SpecName.inputs_2"
 */
function extractEntityNameFromId(entityId: string | undefined): string | null {
  if (!entityId) return null;

  // Get the last part after the last dot that contains the collection
  const parts = entityId.split(".");
  const lastPart = parts[parts.length - 1];

  // Extract type and number (e.g., "tasks_1" -> "Task 1")
  const match = lastPart.match(/^(task|input|output|binding)s?_(\d+)$/i);
  if (match) {
    const type = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    return `${type} ${match[2]}`;
  }

  return null;
}

/**
 * Check if an annotation path is for position.
 */
function isPositionAnnotation(pathStr: string, value: unknown): boolean {
  // Check if path contains position annotation key
  if (pathStr.includes(EDITOR_POSITION_ANNOTATION)) {
    return true;
  }
  // Check if this is a .value property being set on an annotation
  if (pathStr.endsWith(".value") && pathStr.includes(".annotations.")) {
    // Try to parse as position JSON
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (
          parsed &&
          typeof parsed.x === "number" &&
          typeof parsed.y === "number"
        ) {
          return true;
        }
      } catch {
        // Not JSON, not a position
      }
    }
  }
  // Check if value is a position annotation entity being set
  if (
    pathStr.includes(".annotations.") &&
    pathStr.includes(".entities.") &&
    value &&
    typeof value === "object"
  ) {
    const obj = value as { key?: string };
    if (obj.key === EDITOR_POSITION_ANNOTATION) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an operation path is for an entity addition/removal.
 * Entity paths end with the entity ID (not a property on the entity).
 */
function isEntityOperation(pathStr: string, collectionName: string): boolean {
  // Match patterns like "tasks.entities.root.spec.tasks_1" (no further nesting)
  // The entity ID can contain dots, so we look for the collection name followed by entities
  const pattern = new RegExp(
    `${collectionName}\\.entities\\.[^.]+(?:\\.[^.]+)*$`,
  );

  // But exclude paths that go into nested properties like .name, .annotations, etc.
  const hasNestedProperty =
    /\.(name|annotations|arguments|componentRef|isEnabled|executionOptions|sourceEntityId|targetEntityId|sourcePortName|targetPortName|type|description|value|key)$/i.test(
      pathStr,
    );

  return pattern.test(pathStr) && !hasNestedProperty;
}

/**
 * Categorize operations by type and action.
 */
function categorizeOperations(ops: ValtioOperation[]): CategorizedOps {
  const result: CategorizedOps = {
    taskAdd: [],
    taskRemove: [],
    bindingAdd: [],
    bindingRemove: [],
    inputAdd: [],
    inputRemove: [],
    outputAdd: [],
    outputRemove: [],
    nameChange: [],
    positionChange: [],
    annotationChange: [],
    argumentChange: [],
  };

  for (const op of ops) {
    const [opType, path, value, prevValue] = op;
    const pathStr = path.join(".");

    // Name changes (for rename detection)
    if (
      pathStr.endsWith(".name") &&
      opType === "set" &&
      typeof value === "string" &&
      typeof prevValue === "string" &&
      value !== prevValue
    ) {
      result.nameChange.push(op);
      continue;
    }

    // Annotation changes
    if (pathStr.includes(".annotations.")) {
      if (isPositionAnnotation(pathStr, value)) {
        result.positionChange.push(op);
      } else {
        result.annotationChange.push(op);
      }
      continue;
    }

    // Argument changes
    if (pathStr.includes(".arguments.")) {
      result.argumentChange.push(op);
      continue;
    }

    // Task operations
    if (pathStr.includes(".tasks.") && pathStr.includes(".entities.")) {
      if (isEntityOperation(pathStr, "tasks")) {
        if (opType === "set" && value && !prevValue) {
          result.taskAdd.push(op);
        } else if (
          (opType === "set" && !value && prevValue) ||
          opType === "delete"
        ) {
          result.taskRemove.push(op);
        }
      }
      continue;
    }

    // Binding operations
    if (pathStr.includes(".bindings.") && pathStr.includes(".entities.")) {
      if (isEntityOperation(pathStr, "bindings")) {
        if (opType === "set" && value && !prevValue) {
          result.bindingAdd.push(op);
        } else if (
          (opType === "set" && !value && prevValue) ||
          opType === "delete"
        ) {
          result.bindingRemove.push(op);
        }
      }
      continue;
    }

    // Input operations
    if (pathStr.includes("inputs.") && pathStr.includes(".entities.")) {
      if (isEntityOperation(pathStr, "inputs")) {
        if (opType === "set" && value && !prevValue) {
          result.inputAdd.push(op);
        } else if (
          (opType === "set" && !value && prevValue) ||
          opType === "delete"
        ) {
          result.inputRemove.push(op);
        }
      }
      continue;
    }

    // Output operations
    if (pathStr.includes("outputs.") && pathStr.includes(".entities.")) {
      if (isEntityOperation(pathStr, "outputs")) {
        if (opType === "set" && value && !prevValue) {
          result.outputAdd.push(op);
        } else if (
          (opType === "set" && !value && prevValue) ||
          opType === "delete"
        ) {
          result.outputRemove.push(op);
        }
      }
      continue;
    }
  }

  return result;
}

/**
 * Format valtio operations into a human-readable description.
 * Analyzes the path and value to determine what changed.
 */
function formatOperation(ops: ValtioOperation[]): string {
  if (ops.length === 0) return "Unknown change";

  const categorized = categorizeOperations(ops);
  const descriptions: string[] = [];

  // Node additions: "<name>" node added
  for (const op of categorized.taskAdd) {
    const name = extractName(op[2]) ?? "Task";
    descriptions.push(`"${name}" node added`);
  }
  for (const op of categorized.inputAdd) {
    const name = extractName(op[2]) ?? "Input";
    descriptions.push(`"${name}" input added`);
  }
  for (const op of categorized.outputAdd) {
    const name = extractName(op[2]) ?? "Output";
    descriptions.push(`"${name}" output added`);
  }

  // Node removals: "<name>" removed
  for (const op of categorized.taskRemove) {
    const name = extractName(op[3]) ?? "Task";
    descriptions.push(`"${name}" removed`);
  }
  for (const op of categorized.inputRemove) {
    const name = extractName(op[3]) ?? "Input";
    descriptions.push(`"${name}" removed`);
  }
  for (const op of categorized.outputRemove) {
    const name = extractName(op[3]) ?? "Output";
    descriptions.push(`"${name}" removed`);
  }

  // Binding additions: "<source>" connected to "<target>"
  for (const op of categorized.bindingAdd) {
    const binding = op[2] as {
      source?: { name?: string };
      target?: { name?: string };
      sourcePortName?: string;
      targetPortName?: string;
      sourceEntityId?: string;
      targetEntityId?: string;
    } | null;

    if (binding) {
      const sourceName =
        binding.source?.name ??
        binding.sourcePortName ??
        extractEntityNameFromId(binding.sourceEntityId) ??
        "source";
      const targetName =
        binding.target?.name ??
        binding.targetPortName ??
        extractEntityNameFromId(binding.targetEntityId) ??
        "target";
      descriptions.push(`"${sourceName}" connected to "${targetName}"`);
    } else {
      descriptions.push("Nodes connected");
    }
  }

  // Binding removals
  for (const op of categorized.bindingRemove) {
    const binding = op[3] as {
      source?: { name?: string };
      target?: { name?: string };
      sourcePortName?: string;
      targetPortName?: string;
      sourceEntityId?: string;
      targetEntityId?: string;
    } | null;

    if (binding) {
      const sourceName =
        binding.source?.name ??
        binding.sourcePortName ??
        extractEntityNameFromId(binding.sourceEntityId) ??
        "source";
      const targetName =
        binding.target?.name ??
        binding.targetPortName ??
        extractEntityNameFromId(binding.targetEntityId) ??
        "target";
      descriptions.push(`"${sourceName}" disconnected from "${targetName}"`);
    } else {
      descriptions.push("Nodes disconnected");
    }
  }

  // If we have descriptions, return them
  if (descriptions.length > 0) {
    // Dedupe and limit
    const unique = [...new Set(descriptions)];
    return unique.slice(0, 3).join(", ") + (unique.length > 3 ? "..." : "");
  }

  // Name changes (renames): "<old>" renamed to "<new>"
  if (categorized.nameChange.length > 0) {
    const op = categorized.nameChange[0];
    const newName = op[2] as string;
    const oldName = op[3] as string;
    return `"${oldName}" renamed to "${newName}"`;
  }

  // Position changes
  if (categorized.positionChange.length > 0) {
    const op = categorized.positionChange[0];
    const pathStr = op[1].join(".");

    if (pathStr.includes("tasks.entities")) {
      return "Node moved";
    } else if (pathStr.includes("inputs.entities")) {
      return "Input moved";
    } else if (pathStr.includes("outputs.entities")) {
      return "Output moved";
    }
    return "Node moved";
  }

  // Other annotation changes
  if (categorized.annotationChange.length > 0) {
    return "Annotations changed";
  }

  // Argument changes
  if (categorized.argumentChange.length > 0) {
    return "Arguments updated";
  }

  return "Spec modified";
}

/**
 * Add a history entry from spec operations.
 * Called from the spec subscription in EditorV2.
 */
export function addHistoryEntry(ops: ValtioOperation[]): void {
  // Skip if disabled
  if (!historyStore.isEnabled) {
    return;
  }

  // Format the operation description
  const description = formatOperation(ops);

  const entry: HistoryEntry = {
    id: generateHistoryId(),
    timestamp: Date.now(),
    description,
  };

  // Add the new entry
  historyStore.entries.push(entry);

  // Trim to max size
  if (historyStore.entries.length > MAX_HISTORY_ENTRIES) {
    historyStore.entries = historyStore.entries.slice(-MAX_HISTORY_ENTRIES);
  }
}

/**
 * Get all history entries.
 */
export function getHistoryEntries(): HistoryEntry[] {
  return historyStore.entries;
}

/**
 * Clear all history entries.
 */
export function clearHistory(): void {
  historyStore.entries = [];
}

/**
 * Enable or disable history tracking.
 */
export function setHistoryEnabled(enabled: boolean): void {
  historyStore.isEnabled = enabled;
}

/**
 * Capture the initial state marker.
 */
export function captureInitialState(): void {
  const entry: HistoryEntry = {
    id: generateHistoryId(),
    timestamp: Date.now(),
    description: "Initial state",
  };

  historyStore.entries = [entry];
}
