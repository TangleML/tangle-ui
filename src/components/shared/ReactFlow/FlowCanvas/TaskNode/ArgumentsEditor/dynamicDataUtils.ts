import type { IconName } from "@/components/ui/icon";
import schema from "@/config/dynamicDataSchema.json";
import type {
  DynamicDataArgument,
  DynamicDataValue,
  SecretArgument,
} from "@/utils/componentSpec";

interface DynamicDataPropertySchema {
  title: string;
  description?: string;
}

interface TaskAnnotationRequirement {
  key: string;
  value?: string;
}

interface DynamicDataGroupSchema {
  title: string;
  icon: string;
  "x-text-color"?: string;
  description?: string;
  "x-requires-dialog"?: boolean;
  "x-task-level-only"?: boolean;
  "x-requires-task-annotation"?: TaskAnnotationRequirement;
  properties?: Record<string, DynamicDataPropertySchema>;
}

interface DynamicDataSchema {
  $schema?: string;
  title?: string;
  type?: string;
  groups: Record<string, DynamicDataGroupSchema>;
}

interface DynamicDataOption {
  key: string;
  title: string;
  description?: string;
}

export type TaskAnnotations = Record<string, unknown>;

interface DynamicDataGroup {
  id: string;
  title: string;
  icon: IconName;
  textColor: string;
  description?: string;
  requiresDialog: boolean;
  taskLevelOnly: boolean;
  requiresTaskAnnotation: TaskAnnotationRequirement | null;
  options: DynamicDataOption[];
}

interface DynamicDataDisplayInfo {
  icon: IconName;
  displayValue: string;
  groupId: string;
  groupTitle: string;
  textColor: string;
}

const dynamicDataSchema = schema as DynamicDataSchema;
const DEFAULT_TEXT_COLOR = "text-gray-600";

/**
 * Parses the dynamic data schema into usable group configurations.
 */
function parseDynamicDataSchema(): DynamicDataGroup[] {
  const groups: DynamicDataGroup[] = [];

  for (const [groupId, groupSchema] of Object.entries(
    dynamicDataSchema.groups,
  )) {
    const options: DynamicDataOption[] = [];

    if (groupSchema.properties) {
      for (const [key, property] of Object.entries(groupSchema.properties)) {
        options.push({
          key,
          title: property.title,
          description: property.description,
        });
      }
    }

    groups.push({
      id: groupId,
      title: groupSchema.title,
      icon: groupSchema.icon as IconName,
      textColor: groupSchema["x-text-color"] ?? DEFAULT_TEXT_COLOR,
      description: groupSchema.description,
      requiresDialog: groupSchema["x-requires-dialog"] ?? false,
      taskLevelOnly: groupSchema["x-task-level-only"] ?? false,
      requiresTaskAnnotation: groupSchema["x-requires-task-annotation"] ?? null,
      options,
    });
  }

  return groups;
}

/**
 * Checks if a task has the required annotation with the expected value.
 */
function hasRequiredTaskAnnotation(
  taskAnnotations: TaskAnnotations | undefined,
  requirement: TaskAnnotationRequirement,
): boolean {
  if (!taskAnnotations) return false;

  const annotationValue = taskAnnotations[requirement.key];
  if (annotationValue === undefined) return false;

  if (requirement.value === undefined) {
    // just key is required
    return true;
  }

  if (typeof annotationValue === "string") {
    return annotationValue === requirement.value;
  }

  return String(annotationValue) === requirement.value;
}

/**
 * Gets available dynamic data groups based on context.
 * @param isTaskLevel - Whether we're at task level (inside a subgraph) vs pipeline level (root)
 * @param taskAnnotations - Task annotations to check requirements against
 */
export function getDynamicDataGroups(
  isTaskLevel: boolean,
  taskAnnotations?: TaskAnnotations,
): DynamicDataGroup[] {
  const allGroups = parseDynamicDataSchema();

  return allGroups.filter((group) => {
    if (group.taskLevelOnly && !isTaskLevel) {
      return false;
    }

    if (
      group.requiresTaskAnnotation &&
      !hasRequiredTaskAnnotation(taskAnnotations, group.requiresTaskAnnotation)
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Creates a DynamicDataArgument for a system data key.
 * @param key - The system data key (e.g., "system/multi_node/node_index")
 */
export function createSystemDataArgument(key: string): DynamicDataArgument {
  return {
    dynamicData: {
      [key]: {},
    },
  };
}

function isSecretData(data: DynamicDataValue): data is SecretArgument {
  return "secret" in data;
}

/**
 * Gets display information for a dynamic data value.
 * @param dynamicData - The dynamic data value to get display info for
 */
export function getDynamicDataDisplayInfo(
  dynamicData: DynamicDataValue,
): DynamicDataDisplayInfo {
  const allGroups = parseDynamicDataSchema();

  if (isSecretData(dynamicData)) {
    const secretsGroup = allGroups.find((g) => g.id === "secrets");
    return {
      icon: "Lock",
      displayValue: dynamicData.secret.name,
      groupId: "secrets",
      groupTitle: secretsGroup?.title ?? "Secrets",
      textColor: secretsGroup?.textColor ?? DEFAULT_TEXT_COLOR,
    };
  }

  const key = Object.keys(dynamicData)[0];

  for (const group of allGroups) {
    const option = group.options.find((opt) => opt.key === key);
    if (option) {
      return {
        icon: group.icon,
        displayValue: option.title,
        groupId: group.id,
        groupTitle: group.title,
        textColor: group.textColor,
      };
    }
  }

  return {
    icon: "Zap",
    displayValue: key,
    groupId: "unknown",
    groupTitle: "Unknown",
    textColor: DEFAULT_TEXT_COLOR,
  };
}
