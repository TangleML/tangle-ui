import type { TaskSpecOutput } from "@/api/types.gen";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import type { ComponentSpec } from "@/utils/componentSpec";
import { getArgumentValue } from "@/utils/nodes/taskArguments";

/**
 * Regex pattern for matching placeholders in the format ${...}
 * Captures the content between ${ and }
 */
const PLACEHOLDER_PATTERN = /\$\{([^}]+)\}/g;

/**
 * Supported placeholder prefixes and their source paths
 */
const PLACEHOLDER_SOURCES = {
  arguments: "arguments",
  date: "date",
} as const;

/**
 * Supported date format keys
 */
type DateFormatKey = "timestamp" | "short" | "long";

type PlaceholderSource = keyof typeof PLACEHOLDER_SOURCES;

/**
 * Parses a placeholder string to extract the source and key
 * @param placeholder - The content inside ${...}, e.g., "arguments.Input Name"
 * @returns An object with source and key, or null if invalid format
 */
function parsePlaceholder(
  placeholder: string,
): { source: PlaceholderSource; key: string } | null {
  const trimmed = placeholder.trim();
  const dotIndex = trimmed.indexOf(".");

  if (dotIndex === -1) {
    return null;
  }

  const source = trimmed.slice(0, dotIndex) as PlaceholderSource;
  const key = trimmed.slice(dotIndex + 1);

  if (!(source in PLACEHOLDER_SOURCES) || !key) {
    return null;
  }

  return { source, key };
}

/**
 * Formats the current date according to the specified format key
 * @param formatKey - The date format key (timestamp, short, long)
 * @returns The formatted date string or undefined if invalid key
 */
function formatDate(formatKey: string): string | undefined {
  const now = new Date();

  switch (formatKey as DateFormatKey) {
    case "timestamp":
      return Math.floor(now.getTime() / 1000).toString();
    case "short":
      return now.toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      });
    case "long":
      return now.toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "long",
      });
    default:
      return undefined;
  }
}

/**
 * Resolves a placeholder value from taskArguments or ComponentSpec
 * @param source - The source type (e.g., "arguments", "date")
 * @param key - The key to look up (e.g., input name, date format)
 * @param componentSpec - The ComponentSpec to resolve values from
 * @param taskArguments - Optional task arguments from execution data (takes priority)
 * @returns The resolved value or undefined if not found
 */
function resolvePlaceholderValue(
  source: PlaceholderSource,
  key: string,
  componentSpec: ComponentSpec,
  taskArguments?: TaskSpecOutput["arguments"],
): string | undefined {
  switch (source) {
    case "arguments": {
      // First, try to get the value from taskArguments if provided
      const taskArgumentValue = getArgumentValue(taskArguments, key);
      if (taskArgumentValue !== undefined) {
        return taskArgumentValue;
      }

      // Fall back to ComponentSpec input value or default
      const input = componentSpec.inputs?.find((input) => input.name === key);
      return input?.value ?? input?.default;
    }
    case "date":
      return formatDate(key);
    default:
      return undefined;
  }
}

/**
 * Pure function that processes a description string by replacing placeholders
 * with values from taskArguments or ComponentSpec.
 *
 * Placeholder format: ${source.key}
 * Currently supported sources:
 * - arguments: Resolves to argument values by name
 *   - First checks taskArguments if provided
 *   - Falls back to ComponentSpec.inputs value or default
 *   Example: ${arguments.Dataset Path} -> value of argument named "Dataset Path"
 * - date: Resolves to current date/time in various formats
 *   - timestamp: Unix timestamp in seconds (e.g., "1705257600")
 *   - short: Short date/time format (e.g., "1/14/26, 3:00 PM")
 *   - long: Long date/time format (e.g., "January 14, 2026 at 3:00:00 PM EST")
 *   Example: ${date.timestamp}, ${date.short}, ${date.long}
 *
 * Unresolved placeholders are left unchanged.
 *
 * @param description - The description string containing placeholders
 * @param componentSpec - The ComponentSpec to resolve placeholder values from
 * @param taskArguments - Optional task arguments from execution data (takes priority)
 * @returns The description with resolved placeholders
 */
export function processDescriptionPlaceholders(
  description: string,
  componentSpec: ComponentSpec,
  taskArguments?: TaskSpecOutput["arguments"],
): string {
  if (!description) {
    return description;
  }

  return description.replace(PLACEHOLDER_PATTERN, (match, placeholder) => {
    const parsed = parsePlaceholder(placeholder);

    if (!parsed) {
      return match;
    }

    const value = resolvePlaceholderValue(
      parsed.source,
      parsed.key,
      componentSpec,
      taskArguments,
    );

    return value !== undefined ? value : match;
  });
}

/**
 * Hook that returns the processed description from the ComponentSpec
 * with all placeholders resolved.
 *
 * Uses taskArguments from execution data if available, otherwise falls back
 * to ComponentSpec input values or defaults.
 *
 * @returns The processed description string, or undefined if no description exists
 */
export function useProcessedDescription(): string | undefined {
  const { componentSpec } = useComponentSpec();
  const executionData = useExecutionDataOptional();
  const taskArguments = executionData?.rootDetails?.task_spec.arguments;

  if (!componentSpec.description) {
    return undefined;
  }

  return processDescriptionPlaceholders(
    componentSpec.description,
    componentSpec,
    taskArguments,
  );
}
